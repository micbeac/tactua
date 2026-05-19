// Vérifie que le trigger on_auth_user_created insère bien une ligne dans
// public.profiles à chaque signup. Crée un user, lit profiles, supprime tout.
// Lancer : node --env-file=.env.local scripts/test-auth.ts

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.ts';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    '❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant.',
  );
  process.exit(1);
}

const supabase = createClient<Database>(url, key, {
  auth: { persistSession: false },
});

const TEST_EMAIL = `test+${Date.now()}@tactua.test`;
const TEST_PASSWORD = 'tactua-test-12345';
const TEST_USERNAME = 'tactua_tester';

async function main() {
  console.log(`▶ Création du user ${TEST_EMAIL}…`);
  const { data: created, error: createErr } =
    await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { username: TEST_USERNAME },
    });
  if (createErr || !created.user)
    throw createErr ?? new Error('No user returned');
  const userId = created.user.id;
  console.log('  user.id =', userId);

  console.log('▶ Lecture de public.profiles…');
  const { data: profile, error: readErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (readErr) throw readErr;

  if (profile.username !== TEST_USERNAME) {
    throw new Error(
      `Le trigger n'a pas pris le username depuis raw_user_meta_data. Trouvé: "${profile.username}"`,
    );
  }
  if (profile.plan !== 'free') {
    throw new Error(`plan attendu "free", trouvé "${profile.plan}"`);
  }
  console.log('  profile =', profile);

  console.log('▶ Cleanup (delete auth user → cascade vers profiles)…');
  const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
  if (delErr) throw delErr;

  const { data: stillThere } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId);
  if (stillThere && stillThere.length > 0) {
    throw new Error(
      "La cascade de delete depuis auth.users vers profiles n'a pas marché.",
    );
  }
  console.log('  OK, profiles row supprimée par cascade.');

  console.log('\n✅ Trigger on_auth_user_created et cascade delete validés.');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
