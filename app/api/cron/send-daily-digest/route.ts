// Cron quotidien : envoie le digest matinal aux utilisateurs opted-in.
//
// Auth : header `Authorization: Bearer ${CRON_SECRET}`.
// Pas dans vercel.json (limite Hobby 2 cron) — à invoquer manuellement
// ou depuis un orchestrateur externe (GitHub Actions, n8n, etc).
//
// Idéal : 7h00 heure locale Europe/Paris.
//
// Sécurité : ne re-envoie pas si daily_digest_sent_at < 12h.

import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import { renderDailyDigest } from '@/lib/emails/digest-template';
import { FROM, getResend } from '@/lib/emails/client';
import { buildForYouFeed } from '@/lib/data/for-you-feed';
import { getPersonalUpcomingMatches } from '@/lib/data/favorites';
import { getDailyRecap } from '@/lib/data/recap';
import { getRecommendedPlayers } from '@/lib/data/recommendations';
import { getWeeklyRecap } from '@/lib/data/weekly-recap';
import { SITE_URL } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min : on traite ~50 emails par run
export const dynamic = 'force-dynamic';

const MIN_HOURS_BETWEEN_SENDS = 12;

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'RESEND_API_KEY manquant' },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') ?? '50');
  const dryRun = url.searchParams.get('dry') === '1';
  const userIdFilter = url.searchParams.get('user_id');

  const supabase = createAdminClient();

  // Liste des destinataires : profiles opted-in qui n'ont pas eu de digest
  // dans les 12 dernières heures.
  const twelveHoursAgo = new Date(
    Date.now() - MIN_HOURS_BETWEEN_SENDS * 60 * 60 * 1000,
  ).toISOString();

  let query = supabase
    .from('profiles')
    .select('id, username, daily_digest_enabled, daily_digest_sent_at')
    .eq('daily_digest_enabled', true)
    .or(
      `daily_digest_sent_at.is.null,daily_digest_sent_at.lt.${twelveHoursAgo}`,
    )
    .limit(limit);

  if (userIdFilter) query = query.eq('id', userIdFilter);

  const { data: profiles, error: profilesErr } = await query;
  if (profilesErr) {
    return NextResponse.json(
      { ok: false, error: `Failed to fetch profiles: ${profilesErr.message}` },
      { status: 500 },
    );
  }

  type CronError = { user_id: string; step: string; message: string };
  const stats = {
    candidates: profiles?.length ?? 0,
    sent: 0,
    skipped_empty: 0,
    errors: [] as CronError[],
  };

  for (const profile of profiles ?? []) {
    try {
      // Récupère l'email auth.users (pas dans profiles)
      const { data: userResp } = await supabase.auth.admin.getUserById(
        profile.id,
      );
      const email = userResp.user?.email;
      if (!email) {
        stats.errors.push({
          user_id: profile.id,
          step: 'fetch_user',
          message: 'No email on user',
        });
        continue;
      }

      // Build la data du digest (mêmes helpers que le dashboard)
      const [personal, recap, weeklyRecap, recommendations] = await Promise.all(
        [
          getPersonalUpcomingMatches(supabase, profile.id, 8),
          getDailyRecap(supabase, profile.id),
          getWeeklyRecap(supabase, profile.id),
          getRecommendedPlayers(supabase, profile.id, 5),
        ],
      );

      const feed = buildForYouFeed({
        personal,
        recap,
        weeklyRecap,
        recommendations,
      });

      // Skip les users sans aucune activité ni favori — pas la peine d'envoyer
      const matchesTodayCount = recap.matches_today.length;
      if (feed.length === 0 && matchesTodayCount === 0) {
        stats.skipped_empty += 1;
        continue;
      }

      const unsubscribeUrl = `${SITE_URL}/account/notifications?action=unsubscribe&token=${profile.id}`;
      const { subject, html, text } = await renderDailyDigest({
        user_label: profile.username ?? null,
        feed,
        matches_today_count: matchesTodayCount,
        unsubscribe_url: unsubscribeUrl,
      });

      if (dryRun) {
        console.log(
          `[digest:dry] would send to ${email} — subject: "${subject}" — ${feed.length} items`,
        );
        stats.sent += 1;
        continue;
      }

      const resend = getResend();
      const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject,
        html,
        text,
      });

      if (result.error) {
        throw new Error(`Resend: ${result.error.message}`);
      }

      // Mark sent
      await supabase
        .from('profiles')
        .update({ daily_digest_sent_at: new Date().toISOString() })
        .eq('id', profile.id);

      stats.sent += 1;
    } catch (e) {
      stats.errors.push({
        user_id: profile.id,
        step: 'send',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log('[cron:send-daily-digest]', stats);
  return NextResponse.json({ ok: stats.errors.length === 0, stats });
}
