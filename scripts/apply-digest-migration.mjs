import { createClient } from '@supabase/supabase-js';

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Test si la colonne existe
const { error } = await supa
  .from('profiles')
  .update({ daily_digest_enabled: true })
  .eq('id', '00000000-0000-0000-0000-000000000000')
  .select('id, daily_digest_enabled')
  .maybeSingle();

if (error && error.message.includes('daily_digest_enabled')) {
  console.log("❌ Colonnes manquantes. SQL à exécuter dans le dashboard Supabase :");
  console.log(`
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_digest_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_digest_sent_at timestamptz;
  `);
  process.exit(1);
}
console.log('✅ Colonnes daily_digest_enabled / daily_digest_sent_at OK');
