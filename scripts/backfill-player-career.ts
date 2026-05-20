// Backfill carrière + profile pour un joueur donné.
// Lancer : node --env-file=.env.local scripts/backfill-player-career.ts <playerIdInDb>
// (le playerId DB doit être un ID API-Football pour que les endpoints répondent)

import {
  fetchPlayerProfile,
  fetchPlayerTransfers,
} from '../lib/api-football/deep-stats.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const dbId = Number(process.argv[2]);
const afId = Number(process.argv[3] ?? process.argv[2]);
if (!Number.isFinite(dbId) || !Number.isFinite(afId)) {
  console.error(
    'Usage: node --env-file=.env.local scripts/backfill-player-career.ts <dbPlayerId> [apiFootballPlayerId]',
  );
  console.error('Si afId omis, on suppose dbId == afId.');
  process.exit(1);
}

const supabase = createAdminClient();

async function main() {
  console.log(`▶ Fetch profile API-Football ${afId}…`);
  const profile = await fetchPlayerProfile(afId);
  if (!profile) {
    console.log('  ⚠ Aucun profile retourné');
  } else {
    console.log('  OK', profile);
  }

  console.log(`▶ Fetch transfers API-Football ${afId}…`);
  const transfers = await fetchPlayerTransfers(afId);
  console.log(`  ${transfers.length} transferts`);

  console.log(`▶ Update player DB id ${dbId}…`);
  const { error, count } = await supabase
    .from('players')
    .update({
      height: profile?.height_cm ?? null,
      weight: profile?.weight_kg ?? null,
      birth_place: profile?.birth_place ?? null,
      birth_country: profile?.birth_country ?? null,
      date_of_birth: profile?.birth_date ?? null,
      transfers_json: JSON.parse(JSON.stringify(transfers)),
    })
    .eq('id', dbId)
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  console.log(`✅ OK (${count ?? 0} ligne(s) mise(s) à jour)`);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
