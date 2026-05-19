import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Client server-side avec service_role : bypasse RLS.
 * À n'utiliser QUE dans des contextes server (route handlers cron, scripts admin).
 * NE JAMAIS importer depuis un Client Component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant.',
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
