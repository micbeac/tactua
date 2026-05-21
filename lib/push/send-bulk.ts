// Helper pour envoyer une push à un set de users en parallèle.
// Gère :
//   - Lookup des subscriptions actives par user_id
//   - Envoi parallèle (limité à 10 concurrent)
//   - Suppression auto des subscriptions expirées (404/410)
//   - Log dans push_log
//   - Filtrage par préférences user (notify_goals, notify_lineup_confirmed, etc.)

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { sendPush, type PushPayload } from './client';

type Supa = SupabaseClient<Database>;

export type PushEventType =
  | 'goal'
  | 'lineup_confirmed'
  | 'admin_broadcast';

export type BulkPushResult = {
  attempted: number;
  sent: number;
  failed: number;
  expired_removed: number;
};

const CONCURRENCY = 10;

/**
 * Envoie une push à tous les users de la liste qui :
 *   1. Ont au moins une push_subscription active
 *   2. Ont la pref activée pour ce type d'event
 */
export async function sendPushToUsers(
  supabase: Supa,
  userIds: string[],
  eventType: PushEventType,
  payload: PushPayload,
): Promise<BulkPushResult> {
  const result: BulkPushResult = {
    attempted: 0,
    sent: 0,
    failed: 0,
    expired_removed: 0,
  };
  if (userIds.length === 0) return result;

  // 1. Filtre par préférences
  const prefColumn =
    eventType === 'goal'
      ? 'notify_goals'
      : eventType === 'lineup_confirmed'
        ? 'notify_lineup_confirmed'
        : 'notify_admin_broadcast';

  // Si pas de pref enregistrée, on considère true par défaut (default DB)
  const { data: prefs } = await supabase
    .from('push_preferences')
    .select(`user_id, ${prefColumn}`)
    .in('user_id', userIds);
  type PrefRow = { user_id: string } & Record<string, unknown>;
  const optOut = new Set<string>();
  for (const p of (prefs ?? []) as unknown as PrefRow[]) {
    if (p[prefColumn] === false) optOut.add(p.user_id);
  }
  const allowedUserIds = userIds.filter((id) => !optOut.has(id));
  if (allowedUserIds.length === 0) return result;

  // 2. Récupère toutes les subscriptions actives pour ces users
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', allowedUserIds);

  type SubRow = {
    id: number;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  };
  const subscriptions = (subs ?? []) as SubRow[];
  result.attempted = subscriptions.length;
  if (subscriptions.length === 0) return result;

  // 3. Envoi en parallèle (concurrency limit)
  const toDelete: number[] = [];
  const logRows: Array<{
    user_id: string;
    type: string;
    title: string;
    body: string;
    url: string | null;
    status: string;
    error: string | null;
  }> = [];

  for (let i = 0; i < subscriptions.length; i += CONCURRENCY) {
    const batch = subscriptions.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (sub) => {
        const res = await sendPush(sub, payload);
        if (res.ok) {
          result.sent += 1;
          logRows.push({
            user_id: sub.user_id,
            type: eventType,
            title: payload.title,
            body: payload.body,
            url: payload.url ?? null,
            status: 'sent',
            error: null,
          });
        } else {
          if (res.expired) {
            toDelete.push(sub.id);
            result.expired_removed += 1;
            logRows.push({
              user_id: sub.user_id,
              type: eventType,
              title: payload.title,
              body: payload.body,
              url: payload.url ?? null,
              status: 'expired',
              error: res.error ?? null,
            });
          } else {
            result.failed += 1;
            logRows.push({
              user_id: sub.user_id,
              type: eventType,
              title: payload.title,
              body: payload.body,
              url: payload.url ?? null,
              status: 'failed',
              error: res.error ?? null,
            });
          }
        }
      }),
    );
  }

  // 4. Cleanup subscriptions expirées
  if (toDelete.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', toDelete);
  }

  // 5. Log (best-effort, non-bloquant)
  if (logRows.length > 0) {
    await supabase.from('push_log').insert(logRows);
  }

  return result;
}
