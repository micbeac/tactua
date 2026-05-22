// Backfill des données de match (events, compos, stats équipe + joueur)
// pour tous les matchs joués de Jupiler Pro League.
//
// La JPL est désormais pleinement couverte par API-Football (events,
// lineups, statistics_fixtures, statistics_players). On enrichit chaque
// match terminé via enrichMatchFromApiFootball (même chemin que le cron
// matchday). Idempotent : ré-exécutable sans risque (tout en upsert).
//
// Quota AF : ~3-4 req par match. ~310 matchs ≈ 1 000-1 200 req. OK Pro.
//
// Lancer :
//   node --env-file=.env.local scripts/backfill-jpl-match-data.ts
//   node --env-file=.env.local scripts/backfill-jpl-match-data.ts 50   # reprend à partir de l'index 50

import { enrichMatchFromApiFootball } from '../lib/api-football/enrich.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const JPL_COMPETITION_ID = 9001;
const supabase = createAdminClient();

async function main() {
  const startIndex = process.argv[2] ? Number(process.argv[2]) : 0;

  const { data: matches } = await supabase
    .from('matches')
    .select('id, kickoff_at')
    .eq('competition_id', JPL_COMPETITION_ID)
    .eq('status', 'finished')
    .order('kickoff_at', { ascending: true });

  const list = ((matches ?? []) as Array<{ id: number; kickoff_at: string }>)
    .slice(startIndex);
  console.log(
    `▶ ${list.length} matchs JPL terminés à enrichir (depuis l'index ${startIndex})\n`,
  );

  let ok = 0;
  let failed = 0;
  let lineups = 0;
  let teamStats = 0;
  let playerStats = 0;
  let events = 0;

  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    const idx = startIndex + i;
    try {
      const r = await enrichMatchFromApiFootball(supabase, m.id);
      lineups += r.lineups_upserted;
      teamStats += r.team_stats_upserted;
      playerStats += r.player_stats_upserted;
      events += r.events_upserted;
      ok += 1;
      console.log(
        `  [${idx}] match ${m.id} ✅ compos:${r.lineups_upserted} statsÉq:${r.team_stats_upserted} statsJ:${r.player_stats_upserted} events:${r.events_upserted}` +
          (r.notes.length ? ` · ${r.notes.join(' / ')}` : ''),
      );
    } catch (e) {
      failed += 1;
      console.log(
        `  [${idx}] match ${m.id} ✗ ${e instanceof Error ? e.message : e}`,
      );
    }
    // enrich fait déjà plusieurs appels AF en interne → délai généreux
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(
    `\n✅ Terminé : ${ok} matchs enrichis, ${failed} échecs\n` +
      `   ${lineups} lignes compos · ${teamStats} stats équipe · ` +
      `${playerStats} stats joueur · ${events} events`,
  );
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
