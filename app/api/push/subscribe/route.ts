// POST /api/push/subscribe
// Reçoit une PushSubscription du navigateur et la sauve en DB.
// Body : { endpoint, keys: { p256dh, auth } }

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  } | null;

  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json(
      { error: 'Invalid subscription payload' },
      { status: 400 },
    );
  }

  const userAgent = request.headers.get('user-agent') ?? null;
  const admin = createAdminClient();

  // Upsert sur l'endpoint (unique). Si l'user re-subscribe sur le même
  // device, on met juste à jour les keys + last_seen_at.
  const { error } = await admin.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      user_agent: userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    console.error('[push subscribe]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
