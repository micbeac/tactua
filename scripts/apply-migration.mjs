import { createClient } from '@supabase/supabase-js';

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { error } = await supa.from('competitions').upsert(
  {
    id: 9001,
    code: 'BJL',
    name: 'Jupiler Pro League',
    country: 'Belgium',
    current_season: '2025',
    api_football_league_id: 144,
  },
  { onConflict: 'id' },
);

if (error) {
  console.error('ERR:', error.message);
  process.exit(1);
}

const { data: row } = await supa
  .from('competitions')
  .select('*')
  .eq('id', 9001)
  .single();
console.log('✅ JPL competition inserted:', JSON.stringify(row));
