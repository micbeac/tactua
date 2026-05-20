// Test de connexion + RLS bypass via service_role.
// Insère, relit puis supprime une compétition jetable (id 999999999).
// Lancer : node --env-file=.env.local scripts/test-db.ts

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.ts';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    '❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local',
  );
  process.exit(1);
}

const supabase = createClient<Database>(url, key, {
  auth: { persistSession: false },
});

const TEST_ID = 999999999;

async function main() {
  console.log('▶ Insert test competition…');
  const { data: ins, error: insErr } = await supabase
    .from('competitions')
    .insert({
      id: TEST_ID,
      name: 'Test Tactuo Jour 2',
      code: 'TEST',
      country: 'TEST',
      current_season: '2026',
    })
    .select()
    .single();
  if (insErr) throw insErr;
  console.log('  OK', ins);

  console.log('▶ Read back…');
  const { data: read, error: readErr } = await supabase
    .from('competitions')
    .select('*')
    .eq('id', TEST_ID)
    .single();
  if (readErr) throw readErr;
  console.log('  OK', read);

  console.log('▶ Delete test row…');
  const { error: delErr } = await supabase
    .from('competitions')
    .delete()
    .eq('id', TEST_ID);
  if (delErr) throw delErr;
  console.log('  OK');

  console.log('\n✅ Connexion + insert + select + delete validés.');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
