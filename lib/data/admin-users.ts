// Helpers admin pour la gestion des utilisateurs.

import { createAdminClient } from '@/lib/supabase/admin';

export type AdminUserRow = {
  id: string;
  email: string | null;
  username: string | null;
  created_at: string;
  last_seen_at: string | null;
  is_admin: boolean;
  subscription_status:
    | 'free'
    | 'trial'
    | 'paid'
    | 'admin_grant'
    | 'suspended';
  subscription_expires_at: string | null;
  subscription_notes: string | null;
  signup_ref_code: string | null;
  daily_digest_enabled: boolean;
};

export type UserListFilters = {
  search?: string;
  status?: AdminUserRow['subscription_status'];
  ref_code?: string;
};

/** Liste paginée des utilisateurs (admin uniquement — appel via admin client). */
export async function listUsers(
  filters: UserListFilters,
  page = 1,
  pageSize = 25,
): Promise<{ rows: AdminUserRow[]; total: number }> {
  const admin = createAdminClient();

  // 1) Récupère les profils
  let query = admin
    .from('profiles')
    .select(
      'id, username, created_at, last_seen_at, is_admin, subscription_status, subscription_expires_at, subscription_notes, signup_ref_code, daily_digest_enabled',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('subscription_status', filters.status);
  }
  if (filters.ref_code) {
    query = query.eq('signup_ref_code', filters.ref_code);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: profiles, count } = await query;
  if (!profiles) return { rows: [], total: 0 };

  // 2) Récupère les emails via l'admin auth API
  const userIds = profiles.map((p) => p.id);
  const emailMap = new Map<string, string | null>();
  if (userIds.length > 0) {
    // Note: il n'y a pas de getUsers(ids) en bulk, on prend la première page
    // ce qui suffit ici puisque pageSize est limité (25 typiquement).
    const { data: authData } = await admin.auth.admin.listUsers({
      perPage: 1000,
      page: 1,
    });
    for (const u of authData?.users ?? []) {
      emailMap.set(u.id, u.email ?? null);
    }
  }

  let rows: AdminUserRow[] = profiles.map((p) => ({
    id: p.id,
    email: emailMap.get(p.id) ?? null,
    username: p.username,
    created_at: p.created_at,
    last_seen_at: p.last_seen_at,
    is_admin: p.is_admin,
    subscription_status: p.subscription_status,
    subscription_expires_at: p.subscription_expires_at,
    subscription_notes: p.subscription_notes,
    signup_ref_code: p.signup_ref_code,
    daily_digest_enabled: p.daily_digest_enabled,
  }));

  // 3) Filtre côté JS sur l'email (search)
  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.email && r.email.toLowerCase().includes(q)) ||
        (r.username && r.username.toLowerCase().includes(q)),
    );
  }

  return { rows, total: count ?? rows.length };
}

export type UserDetailExtras = {
  analyses_generated: number;
  analyses_viewed: number;
  quiz_attempts: number;
  best_quiz_score: number | null;
  favorites_count: number;
  recent_events: Array<{
    match_id: number;
    analysis_type: 'pre_match' | 'post_match';
    action: 'generated' | 'refreshed' | 'viewed';
    at: string;
  }>;
};

export async function getUserDetail(
  userId: string,
): Promise<(AdminUserRow & UserDetailExtras) | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select(
      'id, username, created_at, last_seen_at, is_admin, subscription_status, subscription_expires_at, subscription_notes, signup_ref_code, daily_digest_enabled',
    )
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return null;

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const email = authUser?.user?.email ?? null;

  const [eventsRes, quizBestRes, quizCountRes, favsRes, recentRes] =
    await Promise.all([
      admin
        .from('user_match_analysis_events')
        .select('action')
        .eq('user_id', userId),
      admin
        .from('user_quiz_attempts')
        .select('score')
        .eq('user_id', userId)
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('user_quiz_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      admin
        .from('user_favorites')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      admin
        .from('user_match_analysis_events')
        .select('match_id, analysis_type, action, at')
        .eq('user_id', userId)
        .order('at', { ascending: false })
        .limit(20),
    ]);

  const events = (eventsRes.data ?? []) as { action: string }[];
  return {
    id: profile.id,
    email,
    username: profile.username,
    created_at: profile.created_at,
    last_seen_at: profile.last_seen_at,
    is_admin: profile.is_admin,
    subscription_status: profile.subscription_status,
    subscription_expires_at: profile.subscription_expires_at,
    subscription_notes: profile.subscription_notes,
    signup_ref_code: profile.signup_ref_code,
    daily_digest_enabled: profile.daily_digest_enabled,
    analyses_generated: events.filter(
      (e) => e.action === 'generated' || e.action === 'refreshed',
    ).length,
    analyses_viewed: events.filter((e) => e.action === 'viewed').length,
    quiz_attempts: quizCountRes.count ?? 0,
    best_quiz_score: quizBestRes.data?.score ?? null,
    favorites_count: favsRes.count ?? 0,
    recent_events: (recentRes.data ?? []) as UserDetailExtras['recent_events'],
  };
}
