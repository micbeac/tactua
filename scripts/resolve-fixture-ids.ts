// Résout les api_football_fixture_id pour les matchs DB d'une compétition.
//
// Stratégie : 1 appel `/fixtures?league=X&season=Y` ramène tous les fixtures
// de la saison. On matche chaque fixture sur (date, home_af_id, away_af_id)
// contre nos matchs en DB (via teams.api_football_id).
//
// Lancer :
//   node --env-file=.env.local scripts/resolve-fixture-ids.ts            # toutes compés
//   node --env-file=.env.local scripts/resolve-fixture-ids.ts WC         # une compé
//
// Quota AF : 1 req par compétition (= 7 max). Trivial.

import {
  TRACKED_COMPETITIONS,
  type TrackedCompetitionCode,
} from '../lib/cron/competitions.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const SEASON_DEFAULT = 2025;
const WC_SEASON = 2026;

type FixturesResponse = {
  response: Array<{
    fixture: { id: number; date: string };
    teams: {
      home: { id: number; name: string };
      away: { id: number; name: string };
    };
  }>;
};

async function af<T>(path: string): Promise<T> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error('API_FOOTBALL_KEY manquant');
  const res = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: { 'x-apisports-key': key, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`API-Football ${res.status} on ${path}`);
  return (await res.json()) as T;
}

const supabase = createAdminClient();

async function resolveCompetition(code: TrackedCompetitionCode) {
  const comp = TRACKED_COMPETITIONS.find((c) => c.code === code);
  if (!comp) throw new Error(`Compétition ${code} inconnue`);

  const season = code === 'WC' ? WC_SEASON : SEASON_DEFAULT;
  console.log(
    `\n▶ ${comp.label} (FD ${comp.fd_id} / AF ${comp.af_league_id}) saison ${season}`,
  );

  // 1. Fixtures AF
  const fx = await af<FixturesResponse>(
    `/fixtures?league=${comp.af_league_id}&season=${season}`,
  );
  console.log(`  ${fx.response.length} fixtures AF`);

  // 2. Matchs DB de cette compétition avec équipes confirmées + mapping AF
  const { data: matches } = await supabase
    .from('matches')
    .select(
      `id, kickoff_at, api_football_fixture_id,
       home_team:teams!matches_home_team_id_fkey(api_football_id),
       away_team:teams!matches_away_team_id_fkey(api_football_id)`,
    )
    .eq('competition_id', comp.fd_id)
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null);

  type DbMatch = {
    id: number;
    kickoff_at: string;
    api_football_fixture_id: number | null;
    home_team: { api_football_id: number | null } | null;
    away_team: { api_football_id: number | null } | null;
  };
  const dbList = (matches ?? []) as unknown as DbMatch[];
  console.log(`  ${dbList.length} matchs DB avec équipes`);

  // 3. Index AF fixtures par (date YYYY-MM-DD, home_af, away_af)
  const afIndex = new Map<string, number>();
  for (const f of fx.response) {
    const date = f.fixture.date.slice(0, 10);
    const key = `${date}|${f.teams.home.id}|${f.teams.away.id}`;
    afIndex.set(key, f.fixture.id);
  }

  let matched = 0;
  let already = 0;
  let unmatched: string[] = [];

  for (const m of dbList) {
    const homeAf = m.home_team?.api_football_id;
    const awayAf = m.away_team?.api_football_id;
    if (!homeAf || !awayAf) {
      unmatched.push(`match ${m.id} (équipes non mappées AF)`);
      continue;
    }
    const date = m.kickoff_at.slice(0, 10);
    let fixtureId = afIndex.get(`${date}|${homeAf}|${awayAf}`);
    if (!fixtureId) {
      // Fallback : jour précédent / suivant (décalages timezone)
      for (const delta of [-1, 1]) {
        const dt = new Date(m.kickoff_at);
        dt.setUTCDate(dt.getUTCDate() + delta);
        const altDate = dt.toISOString().slice(0, 10);
        fixtureId = afIndex.get(`${altDate}|${homeAf}|${awayAf}`);
        if (fixtureId) break;
      }
    }
    if (!fixtureId) {
      unmatched.push(`match ${m.id} (${date} ${homeAf}vs${awayAf})`);
      continue;
    }
    if (m.api_football_fixture_id === fixtureId) {
      already += 1;
      continue;
    }
    const { error } = await supabase
      .from('matches')
      .update({ api_football_fixture_id: fixtureId })
      .eq('id', m.id);
    if (error) {
      console.error(`  ✗ match ${m.id} :`, error.message);
    } else {
      matched += 1;
    }
  }

  console.log(
    `  ✅ ${matched} résolus, ${already} déjà, ${unmatched.length} unmatched`,
  );
  if (unmatched.length > 0 && unmatched.length <= 5) {
    console.log('  Unmatched :', unmatched.join(', '));
  }
}

async function main() {
  const codeArg = process.argv[2] as TrackedCompetitionCode | undefined;
  if (codeArg) {
    await resolveCompetition(codeArg);
    return;
  }
  for (const c of TRACKED_COMPETITIONS) {
    try {
      await resolveCompetition(c.code);
      await new Promise((r) => setTimeout(r, 600));
    } catch (e) {
      console.error(`  ✗ ${c.label} :`, e instanceof Error ? e.message : e);
    }
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
