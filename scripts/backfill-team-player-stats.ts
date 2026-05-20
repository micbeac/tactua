// Backfill player_season_stats pour tous les joueurs d'une équipe sur une
// saison/compétition. Matche les joueurs API-Football → DB par nom normalisé.
//
// Lancer :
//   node --env-file=.env.local scripts/backfill-team-player-stats.ts \
//     <dbTeamId> <afTeamId> <leagueId> <season> <dbCompetitionId>
//
// Exemple Bologna Serie A 2025-26 :
//   node --env-file=.env.local scripts/backfill-team-player-stats.ts 103 500 135 2025 2019

import { fetchTopPerformers } from '../lib/api-football/deep-stats.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const dbTeamId = Number(process.argv[2]);
const afTeamId = Number(process.argv[3]);
const leagueId = Number(process.argv[4]);
const season = Number(process.argv[5]);
const dbCompetitionId = Number(process.argv[6]);

if (
  ![dbTeamId, afTeamId, leagueId, season, dbCompetitionId].every(Number.isFinite)
) {
  console.error(
    'Usage: backfill-team-player-stats.ts <dbTeamId> <afTeamId> <leagueId> <season> <dbCompetitionId>',
  );
  process.exit(1);
}

const supabase = createAdminClient();

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function main() {
  console.log(`▶ Charger les joueurs DB de team ${dbTeamId}…`);
  const { data: dbPlayers } = await supabase
    .from('players')
    .select('id, name')
    .eq('current_team_id', dbTeamId);
  const byNorm = new Map<string, number>();
  for (const p of (dbPlayers ?? []) as Array<{ id: number; name: string }>) {
    byNorm.set(normalize(p.name), p.id);
  }
  console.log(`  ${dbPlayers?.length ?? 0} joueurs en DB`);

  console.log(`▶ Fetch stats API-Football team ${afTeamId} league ${leagueId} season ${season}…`);
  // On utilise fetchTopPerformers avec topN très grand pour avoir TOUS les joueurs.
  const perfs = await fetchTopPerformers(afTeamId, leagueId, season, 100);
  console.log(`  ${perfs.length} joueurs avec stats`);

  const rows: Array<{
    player_id: number;
    competition_id: number;
    season: string;
    appearances: number;
    minutes: number;
    goals: number;
    assists: number;
    yellow_cards: number;
    red_cards: number;
  }> = [];

  let matched = 0;
  let unmatched: string[] = [];

  for (const p of perfs) {
    const norm = normalize(p.player_name);
    const dbId = byNorm.get(norm);
    if (!dbId) {
      unmatched.push(p.player_name);
      continue;
    }
    matched += 1;
    rows.push({
      player_id: dbId,
      competition_id: dbCompetitionId,
      season: String(season),
      appearances: p.appearances,
      minutes: p.minutes,
      goals: p.goals,
      assists: p.assists,
      yellow_cards: p.yellow_cards,
      red_cards: p.red_cards,
    });
  }

  console.log(`▶ Matched : ${matched} / Unmatched : ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log('  Unmatched names :', unmatched.slice(0, 5).join(', '));
  }

  if (rows.length === 0) {
    console.log('  Rien à upsert');
    return;
  }

  console.log(`▶ Upsert ${rows.length} player_season_stats…`);
  const { error } = await supabase
    .from('player_season_stats')
    .upsert(rows, { onConflict: 'player_id,competition_id,season' });
  if (error) throw error;
  console.log('✅ OK');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
