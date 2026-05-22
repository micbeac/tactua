// Helpers data pour le fil d'actualité Coupe du Monde (table wc_news).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type WCNewsStatus = 'draft' | 'published' | 'archived';
export type WCNewsCategory = 'selection' | 'tournoi';

export type WCNewsArticle = {
  id: number;
  team_id: number | null;
  category: string;
  title: string;
  slug: string | null;
  source_url: string | null;
  source_name: string | null;
  snippet: string | null;
  scraped_at: string;
  published_at: string | null;
  status: string;
  ai_summary: string | null;
  ai_content: string | null;
  ai_perspective: string | null;
  ai_generated_at: string | null;
  ai_model: string | null;
  video_youtube_id: string | null;
  edited_at: string | null;
  created_at: string;
  team: { id: number; name: string; logo_url: string | null } | null;
};

const SELECT = `
  id, team_id, category, title, slug, source_url, source_name, snippet,
  scraped_at, published_at, status, ai_summary, ai_content, ai_perspective,
  ai_generated_at, ai_model, video_youtube_id, edited_at, created_at,
  team:teams!wc_news_team_id_fkey(id, name, logo_url)
`;

/** Tous les articles (admin) — drafts inclus, plus récents d'abord. */
export async function getWCNewsAdmin(supabase: Supa): Promise<WCNewsArticle[]> {
  const { data } = await supabase
    .from('wc_news')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(500);
  return (data ?? []) as unknown as WCNewsArticle[];
}

/** Articles publiés (public), paginés. */
export async function getPublishedWCNews(
  supabase: Supa,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ articles: WCNewsArticle[]; total: number }> {
  const limit = opts.limit ?? 18;
  const offset = opts.offset ?? 0;
  const { data, count } = await supabase
    .from('wc_news')
    .select(SELECT, { count: 'exact' })
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  return {
    articles: (data ?? []) as unknown as WCNewsArticle[],
    total: count ?? 0,
  };
}

/** Un article publié par son slug (page détail). */
export async function getWCNewsBySlug(
  supabase: Supa,
  slug: string,
): Promise<WCNewsArticle | null> {
  const { data } = await supabase
    .from('wc_news')
    .select(SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  return (data as unknown as WCNewsArticle | null) ?? null;
}

/** Derniers articles publiés (bloc actu sur la page CDM). */
export async function getLatestWCNews(
  supabase: Supa,
  limit = 6,
): Promise<WCNewsArticle[]> {
  const { data } = await supabase
    .from('wc_news')
    .select(SELECT)
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as unknown as WCNewsArticle[];
}
