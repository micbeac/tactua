// Helpers admin : check de privilège + stats du dashboard.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

/** Retourne true si l'utilisateur courant est admin. Null si pas loggé. */
export async function getAdminUser(): Promise<
  | { user_id: string; email: string | null; is_admin: true }
  | { user_id: string; email: string | null; is_admin: false }
  | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  return {
    user_id: user.id,
    email: user.email ?? null,
    is_admin: Boolean(profile?.is_admin),
  };
}

export type DashboardStats = {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  subscription_breakdown: {
    free: number;
    trial: number;
    paid: number;
    admin_grant: number;
    suspended: number;
  };
  active_users_7d: number; // last_seen_at >= now - 7d
  activity_7d: {
    analyses_generated: number;
    analyses_viewed: number;
    quiz_completed: number;
    favorites_added: number;
  };
};

export async function getDashboardStats(
  supabase: SupabaseClient<Database>,
): Promise<DashboardStats> {
  const now = Date.now();
  const d7 = new Date(now - 7 * 86_400_000).toISOString();
  const d30 = new Date(now - 30 * 86_400_000).toISOString();

  const [
    totalRes,
    new7Res,
    new30Res,
    subsRes,
    active7Res,
    eventsRes,
    quizRes,
    favsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', d7),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', d30),
    supabase.from('profiles').select('subscription_status'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('last_seen_at', d7),
    supabase
      .from('user_match_analysis_events')
      .select('action')
      .gte('at', d7),
    supabase
      .from('user_quiz_attempts')
      .select('id', { count: 'exact', head: true })
      .gte('completed_at', d7),
    supabase
      .from('user_favorites')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', d7),
  ]);

  const breakdown = {
    free: 0,
    trial: 0,
    paid: 0,
    admin_grant: 0,
    suspended: 0,
  };
  for (const row of subsRes.data ?? []) {
    const s = row.subscription_status as keyof typeof breakdown;
    if (s in breakdown) breakdown[s]++;
  }

  const events = (eventsRes.data ?? []) as { action: string }[];
  const generated = events.filter(
    (e) => e.action === 'generated' || e.action === 'refreshed',
  ).length;
  const viewed = events.filter((e) => e.action === 'viewed').length;

  return {
    total_users: totalRes.count ?? 0,
    new_users_7d: new7Res.count ?? 0,
    new_users_30d: new30Res.count ?? 0,
    subscription_breakdown: breakdown,
    active_users_7d: active7Res.count ?? 0,
    activity_7d: {
      analyses_generated: generated,
      analyses_viewed: viewed,
      quiz_completed: quizRes.count ?? 0,
      favorites_added: favsRes.count ?? 0,
    },
  };
}

/** Récupère les stats Plausible (visiteurs/pageviews) sur 7j et 30j. */
export type PlausibleStats = {
  visitors_7d: number | null;
  pageviews_7d: number | null;
  visitors_30d: number | null;
  pageviews_30d: number | null;
};

export async function getPlausibleStats(): Promise<PlausibleStats> {
  const apiKey = process.env.PLAUSIBLE_API_KEY;
  const siteId = process.env.PLAUSIBLE_SITE_ID;
  if (!apiKey || !siteId) {
    return {
      visitors_7d: null,
      pageviews_7d: null,
      visitors_30d: null,
      pageviews_30d: null,
    };
  }
  async function fetchPeriod(
    period: '7d' | '30d',
  ): Promise<{ visitors: number; pageviews: number } | null> {
    try {
      const url = new URL('https://plausible.io/api/v1/stats/aggregate');
      url.searchParams.set('site_id', siteId!);
      url.searchParams.set('period', period);
      url.searchParams.set('metrics', 'visitors,pageviews');
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        results: { visitors: { value: number }; pageviews: { value: number } };
      };
      return {
        visitors: json.results?.visitors?.value ?? 0,
        pageviews: json.results?.pageviews?.value ?? 0,
      };
    } catch {
      return null;
    }
  }
  const [d7, d30] = await Promise.all([fetchPeriod('7d'), fetchPeriod('30d')]);
  return {
    visitors_7d: d7?.visitors ?? null,
    pageviews_7d: d7?.pageviews ?? null,
    visitors_30d: d30?.visitors ?? null,
    pageviews_30d: d30?.pageviews ?? null,
  };
}

/** Conversion funnel : visiteurs Plausible → inscrits → payants. */
export type ConversionFunnel = {
  period: '7d' | '30d';
  visitors: number | null;
  signups: number;
  paying: number;
  visitor_to_signup_pct: number | null;
  signup_to_paying_pct: number | null;
};

export async function getConversionFunnel(
  period: '7d' | '30d',
): Promise<ConversionFunnel> {
  const admin = createAdminClient();
  const days = period === '7d' ? 7 : 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [signupsRes, payingRes, plausible] = await Promise.all([
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
      .in('subscription_status', ['paid', 'admin_grant']),
    getPlausibleStats(),
  ]);

  const visitors =
    period === '7d' ? plausible.visitors_7d : plausible.visitors_30d;
  const signups = signupsRes.count ?? 0;
  const paying = payingRes.count ?? 0;

  return {
    period,
    visitors,
    signups,
    paying,
    visitor_to_signup_pct:
      visitors && visitors > 0
        ? Math.round((signups / visitors) * 1000) / 10
        : null,
    signup_to_paying_pct:
      signups > 0 ? Math.round((paying / signups) * 1000) / 10 : null,
  };
}
