// Mapping FD→AF des équipes. Pour chaque compétition trackée :
//   1. Charge les équipes DB (id, name, tla) ayant joué dans la compétition
//   2. Fetch la liste API-Football /teams?league=X&season=Y
//   3. Match par nom normalisé (ou tla), écrit teams.api_football_id
//
// Lancer :
//   node --env-file=.env.local scripts/map-teams.ts            # toutes
//   node --env-file=.env.local scripts/map-teams.ts 135 2025   # une seule
//
// Args optionnels : <leagueId> <season>. Si omis, itère TRACKED_COMPETITIONS
// avec season courante. Respecte un délai entre requêtes (quota AF Pro = 7500/j).

import { TRACKED_COMPETITIONS } from '../lib/cron/competitions.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const BASE_URL = 'https://v3.football.api-sports.io';
const SEASON_DEFAULT = 2025; // Saison 2025-26

function apiKey(): string {
  const k = process.env.API_FOOTBALL_KEY;
  if (!k) throw new Error('API_FOOTBALL_KEY manquant');
  return k;
}

type TeamsResponse = {
  response: Array<{
    team: { id: number; name: string; code: string | null; country: string };
  }>;
};

async function af<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': apiKey(), Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`API-Football ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(fc|cf|sc|ac|as|us|ssc|cd|rcd|afc|bk|if)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const supabase = createAdminClient();

async function mapOneLeague(
  fdCompetitionId: number,
  afLeagueId: number,
  season: number,
  label: string,
) {
  console.log(`\n▶ ${label} (FD ${fdCompetitionId} → AF ${afLeagueId}, saison ${season})`);

  // 1. Équipes DB ayant joué dans cette compétition
  const { data: dbTeamsRaw } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id')
    .eq('competition_id', fdCompetitionId)
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null);

  const teamIds = new Set<number>();
  for (const m of (dbTeamsRaw ?? []) as Array<{
    home_team_id: number;
    away_team_id: number;
  }>) {
    teamIds.add(m.home_team_id);
    teamIds.add(m.away_team_id);
  }

  if (teamIds.size === 0) {
    console.log('  Pas d\'équipes DB pour cette compétition (matches encore vides)');
    return;
  }

  const { data: dbTeams } = await supabase
    .from('teams')
    .select('id, name, tla, api_football_id')
    .in('id', Array.from(teamIds));

  type DbTeam = {
    id: number;
    name: string;
    tla: string | null;
    api_football_id: number | null;
  };
  const dbList = (dbTeams ?? []) as DbTeam[];
  console.log(`  ${dbList.length} équipes DB`);

  // 2. Équipes API-Football
  const d = await af<TeamsResponse>(
    `/teams?league=${afLeagueId}&season=${season}`,
  );
  console.log(`  ${d.response.length} équipes API-Football`);

  const afByNorm = new Map<string, { id: number; name: string }>();
  const afByCode = new Map<string, { id: number; name: string }>();
  for (const t of d.response) {
    afByNorm.set(normalize(t.team.name), { id: t.team.id, name: t.team.name });
    if (t.team.code) {
      afByCode.set(t.team.code.toUpperCase(), { id: t.team.id, name: t.team.name });
    }
  }

  // 3. Match + update
  let matched = 0;
  let already = 0;
  let unmatched: string[] = [];

  for (const t of dbList) {
    if (t.api_football_id) {
      already += 1;
      continue;
    }
    let hit = afByNorm.get(normalize(t.name));
    if (!hit && t.tla) hit = afByCode.get(t.tla.toUpperCase());
    if (!hit) {
      // Match partiel : tente le nom DB inclus dans un nom AF, ou l'inverse
      const dbNorm = normalize(t.name);
      for (const [afNorm, afTeam] of afByNorm) {
        if (afNorm.includes(dbNorm) || dbNorm.includes(afNorm)) {
          hit = afTeam;
          break;
        }
      }
    }
    if (!hit) {
      unmatched.push(t.name);
      continue;
    }
    const { error } = await supabase
      .from('teams')
      .update({ api_football_id: hit.id })
      .eq('id', t.id);
    if (error) {
      console.error(`  ✗ update ${t.name} → AF ${hit.id} :`, error.message);
    } else {
      matched += 1;
    }
  }

  console.log(
    `  ✅ ${matched} mappés, ${already} déjà, ${unmatched.length} unmatched`,
  );
  if (unmatched.length > 0) {
    console.log('  Unmatched :', unmatched.join(', '));
  }
}

async function main() {
  const leagueArg = process.argv[2] ? Number(process.argv[2]) : null;
  const seasonArg = process.argv[3] ? Number(process.argv[3]) : SEASON_DEFAULT;

  if (leagueArg) {
    // Mode single league
    const comp = TRACKED_COMPETITIONS.find((c) => c.af_league_id === leagueArg);
    if (!comp) throw new Error(`AF league ${leagueArg} non tracké`);
    await mapOneLeague(comp.fd_id, comp.af_league_id, seasonArg, comp.label);
    return;
  }

  for (const c of TRACKED_COMPETITIONS) {
    try {
      await mapOneLeague(c.fd_id, c.af_league_id, seasonArg, c.label);
      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      console.error(`  ✗ ${c.label} :`, e instanceof Error ? e.message : e);
    }
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
