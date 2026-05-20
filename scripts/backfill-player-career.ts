// Backfill carrière + profile pour un joueur donné.
// Lancer : node --env-file=.env.local scripts/backfill-player-career.ts <playerIdInDb>
// (le playerId DB doit être un ID API-Football pour que les endpoints répondent)

import {
  fetchPlayerProfile,
  fetchPlayerTransfers,
} from '../lib/api-football/deep-stats.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const playerId = Number(process.argv[2]);
if (!Number.isFinite(playerId)) {
  console.error(
    'Usage: node --env-file=.env.local scripts/backfill-player-career.ts <playerId>',
  );
  process.exit(1);
}

const supabase = createAdminClient();

async function main() {
  console.log(`▶ Fetch profile player ${playerId}…`);
  const profile = await fetchPlayerProfile(playerId);
  if (!profile) {
    console.log('  ⚠ Aucun profile retourné');
  } else {
    console.log('  OK', profile);
  }

  console.log(`▶ Fetch transfers player ${playerId}…`);
  const transfers = await fetchPlayerTransfers(playerId);
  console.log(`  ${transfers.length} transferts`);

  console.log(`▶ Update player ${playerId} en DB…`);
  const { error } = await supabase
    .from('players')
    .update({
      height: profile?.height_cm ?? null,
      weight: profile?.weight_kg ?? null,
      birth_place: profile?.birth_place ?? null,
      birth_country: profile?.birth_country ?? null,
      date_of_birth: profile?.birth_date ?? null,
      transfers_json: JSON.parse(JSON.stringify(transfers)),
    })
    .eq('id', playerId);
  if (error) throw error;
  console.log('✅ OK');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
