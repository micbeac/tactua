'use server';

import { revalidatePath } from 'next/cache';
import { getAdminUser } from '@/lib/data/admin';
import { sendPushToUsers } from '@/lib/push/send-bulk';
import { createAdminClient } from '@/lib/supabase/admin';

type BroadcastPayload = {
  title: string;
  body: string;
  url?: string;
  requireInteraction?: boolean;
};

type BroadcastResult =
  | {
      ok: true;
      attempted: number;
      sent: number;
      failed: number;
      expired_removed: number;
    }
  | { ok: false; message: string };

export async function sendAdminBroadcast(
  payload: BroadcastPayload,
): Promise<BroadcastResult> {
  const admin = await getAdminUser();
  if (!admin || !admin.is_admin) {
    return { ok: false, message: 'Accès refusé' };
  }

  if (!payload.title.trim() || !payload.body.trim()) {
    return { ok: false, message: 'Titre et message requis' };
  }

  const supabase = createAdminClient();

  // Récupère tous les user_ids ayant au moins une push subscription
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id');
  const userIds = Array.from(
    new Set((subs ?? []).map((s) => s.user_id)),
  );

  if (userIds.length === 0) {
    return { ok: false, message: 'Aucun abonné' };
  }

  const res = await sendPushToUsers(supabase, userIds, 'admin_broadcast', {
    title: payload.title,
    body: payload.body,
    url: payload.url || '/',
    icon: '/favicon.png',
    requireInteraction: payload.requireInteraction,
  });

  revalidatePath('/admin/push');

  return {
    ok: true,
    attempted: res.attempted,
    sent: res.sent,
    failed: res.failed,
    expired_removed: res.expired_removed,
  };
}
