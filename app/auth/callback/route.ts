import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { sendTemplatedEmail } from '@/lib/emails/db-templates';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// Callback appelé par Supabase après confirmation email / OAuth.
// Échange le `code` contre une session, attribue un partenaire éventuel
// (cookie tactuo_ref), envoie le welcome email, puis redirige.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const supabase = await createClient();
  const { error: exchangeError, data } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const user = data.user;
  const admin = createAdminClient();

  // Lit le profil pour décider si c'est la 1re confirmation
  const { data: profile } = await admin
    .from('profiles')
    .select('signup_ref_code, daily_digest_sent_at, last_seen_at, created_at')
    .eq('id', user.id)
    .maybeSingle();

  const isFirstConfirm =
    profile != null &&
    !profile.last_seen_at &&
    Math.abs(
      Date.now() - new Date(profile.created_at).getTime(),
    ) < 7 * 24 * 60 * 60 * 1000;

  // Capture le ref code (cookie set par RefCapture avant signup)
  const cookieStore = await cookies();
  const refCookie = cookieStore.get('tactuo_ref')?.value;

  if (refCookie && (!profile?.signup_ref_code || profile.signup_ref_code === '')) {
    await admin
      .from('profiles')
      .update({ signup_ref_code: refCookie })
      .eq('id', user.id);

    // Crée la row partner_referrals si le slug correspond à un partner actif
    const { data: partner } = await admin
      .from('partners')
      .select('id')
      .eq('slug', refCookie)
      .eq('is_active', true)
      .maybeSingle();
    if (partner) {
      await admin
        .from('partner_referrals')
        .upsert(
          { partner_id: partner.id, user_id: user.id },
          { onConflict: 'partner_id,user_id', ignoreDuplicates: true },
        );
    }
  }

  // Met à jour last_seen_at
  await admin
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', user.id);

  // Welcome email à la 1re confirmation seulement, et de manière non bloquante
  if (isFirstConfirm && user.email) {
    const username =
      (user.user_metadata?.username as string | undefined) ??
      user.email.split('@')[0];
    sendTemplatedEmail('welcome', user.email, {
      user_name: username,
    }).catch((e) => {
      console.error('[auth callback] welcome send failed', e);
    });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
