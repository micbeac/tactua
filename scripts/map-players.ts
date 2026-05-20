// Mapping FD→AF des joueurs. Pour chaque équipe ayant un api_football_id :
//   1. Fetch /players/squads?team=X  (gratuit, 1 req par team)
//   2. Pour chaque joueur AF, match par nom normalisé contre les players DB
//      ayant current_team_id = team.id
//   3. Update players.api_football_id sur le row le plus ancien (= ID le plus
//      petit, généralement le row FD original)
//
// Lancer :
//   node --env-file=.env.local scripts/map-players.ts            # toutes équipes
//   node --env-file=.env.local scripts/map-players.ts <dbTeamId> # une équipe
//
// Quota AF : 1 req par équipe = ~110 req pour tout. OK même en plan Pro.

import { createAdminClient } from '../lib/supabase/admin.ts';
import { fetchSquad } from '../lib/api-football/deep-stats.ts';

const supabase = createAdminClient();

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

type DbPlayer = {
  id: number;
  name: string;
  api_football_id: number | null;
};

async function mapTeamPlayers(
  dbTeamId: number,
  afTeamId: number,
  teamName: string,
) {
  console.log(`\n▶ ${teamName} (DB ${dbTeamId} → AF ${afTeamId})`);

  const squad = await fetchSquad(afTeamId);
  if (squad.length === 0) {
    console.log('  Squad AF vide');
    return;
  }

  const { data: dbPlayers } = await supabase
    .from('players')
    .select('id, name, api_football_id')
    .eq('current_team_id', dbTeamId)
    .order('id', { ascending: true });

  const dbList = (dbPlayers ?? []) as DbPlayer[];
  console.log(`  Squad AF=${squad.length} / DB=${dbList.length}`);

  // Map nom normalisé → DbPlayer le plus ancien (= ID le plus petit).
  // On indexe à la fois sur nom complet et sur nom de famille (dernier mot)
  // pour matcher les "R. James" / "Reece James" / "Reece Nelson James".
  const byNorm = new Map<string, DbPlayer>();
  const byLast = new Map<string, DbPlayer>();
  for (const p of dbList) {
    const n = normalize(p.name);
    if (!byNorm.has(n)) byNorm.set(n, p);
    const parts = p.name.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    if (last && last.length >= 4) {
      const lastN = normalize(last);
      if (!byLast.has(lastN)) byLast.set(lastN, p);
    }
  }

  let matched = 0;
  let already = 0;
  let unmatched: string[] = [];

  for (const af of squad) {
    const n = normalize(af.name);
    let hit = byNorm.get(n);
    if (!hit) {
      // Fallback : match partiel (un nom contient l'autre)
      for (const [dbNorm, p] of byNorm) {
        if (dbNorm.includes(n) || n.includes(dbNorm)) {
          hit = p;
          break;
        }
      }
    }
    if (!hit) {
      // Fallback nom de famille uniquement (dernier mot AF, len >= 4)
      const afParts = af.name.trim().split(/\s+/);
      const afLast = afParts[afParts.length - 1];
      if (afLast && afLast.length >= 4) {
        hit = byLast.get(normalize(afLast));
      }
    }
    if (!hit) {
      unmatched.push(af.name);
      continue;
    }
    if (hit.api_football_id === af.player_id) {
      already += 1;
      continue;
    }
    const { error } = await supabase
      .from('players')
      .update({ api_football_id: af.player_id })
      .eq('id', hit.id);
    if (error) {
      console.error(`  ✗ ${af.name} → ${error.message}`);
    } else {
      matched += 1;
    }
  }

  console.log(
    `  ✅ ${matched} mappés, ${already} déjà, ${unmatched.length} unmatched`,
  );
  if (unmatched.length > 0 && unmatched.length <= 10) {
    console.log('  Unmatched :', unmatched.join(', '));
  }
}

async function main() {
  const singleTeam = process.argv[2] ? Number(process.argv[2]) : null;

  let query = supabase
    .from('teams')
    .select('id, name, api_football_id')
    .not('api_football_id', 'is', null)
    .order('id', { ascending: true });
  if (singleTeam) query = query.eq('id', singleTeam);

  const { data: teams } = await query;
  type TeamRow = { id: number; name: string; api_football_id: number };
  const list = (teams ?? []) as TeamRow[];
  console.log(`▶ ${list.length} équipes à mapper`);

  for (const t of list) {
    try {
      await mapTeamPlayers(t.id, t.api_football_id, t.name);
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.error(`  ✗ ${t.name} :`, e instanceof Error ? e.message : e);
    }
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
