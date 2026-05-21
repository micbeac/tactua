// Force enrich un seul match par son id (debug ou rattrapage cible).
// Usage : MATCH_ID=537180 node --env-file=.env.local --experimental-strip-types scripts/enrich-single-match.ts

import { enrichMatchFromApiFootball } from '../lib/api-football/enrich.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const MATCH_ID = Number(process.env.MATCH_ID);
if (!Number.isFinite(MATCH_ID)) {
  console.error('❌ MATCH_ID env var required');
  process.exit(1);
}

const supabase = createAdminClient();

async function main() {
  console.log(`▶ Vérification match ${MATCH_ID}...`);
  const { data: match } = await supabase
    .from('matches')
    .select(
      'id, kickoff_at, status, api_football_fixture_id, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)',
    )
    .eq('id', MATCH_ID)
    .maybeSingle();

  if (!match) {
    console.error(`❌ Match ${MATCH_ID} introuvable en DB`);
    process.exit(1);
  }

  console.log(`  Trouvé : ${(match.home_team as { name?: string } | null)?.name ?? '?'} vs ${(match.away_team as { name?: string } | null)?.name ?? '?'} @ ${match.kickoff_at}`);
  console.log(`  Status: ${match.status}, AF fixture: ${match.api_football_fixture_id ?? '(non mappé)'}`);

  console.log('\n▶ Lancement enrich...');
  const r = await enrichMatchFromApiFootball(supabase, MATCH_ID);
  console.log('  → fixture_id:', r.fixture_id);
  console.log('  → events_upserted:', r.events_upserted);
  console.log('  → team_stats_upserted:', r.team_stats_upserted);
  console.log('  → player_stats_upserted:', r.player_stats_upserted);
  console.log('  → lineups_upserted:', r.lineups_upserted);
  console.log('  → players_upserted:', r.players_upserted);
  console.log('  → live_minute / status:', r.live_minute, '/', r.live_status);
  if (r.notes.length > 0) {
    console.log('\nNotes :');
    for (const n of r.notes) console.log('  ⚠', n);
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
