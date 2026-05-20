// Test end-to-end enrich d'un match avec API-Football.
// Lancer : node --env-file=.env.local scripts/test-api-football-enrich.ts <matchId>

import { enrichMatchFromApiFootball } from '../lib/api-football/enrich.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const matchId = Number(process.argv[2]);
if (!Number.isFinite(matchId)) {
  console.error(
    'Usage: node --env-file=.env.local scripts/test-api-football-enrich.ts <matchId>',
  );
  process.exit(1);
}

const supabase = createAdminClient();

async function main() {
  console.log(`▶ Enrich du match ${matchId} depuis API-Football…`);
  const result = await enrichMatchFromApiFootball(supabase, matchId);
  console.log('\n--- Résultat ---');
  console.log(JSON.stringify(result, null, 2));
  console.log(
    `\n${result.fixture_id ? '✅' : '⚠️'} Fixture trouvé : ${result.fixture_id ?? 'NON'}`,
  );
  console.log(`Lineups   : ${result.lineups_upserted}`);
  console.log(`Team stats: ${result.team_stats_upserted}`);
  console.log(`Player stats: ${result.player_stats_upserted}`);
  if (result.notes.length > 0) {
    console.log('\nNotes :');
    for (const n of result.notes) console.log(`  - ${n}`);
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
