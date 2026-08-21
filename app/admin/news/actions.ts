'use server';

import { revalidatePath } from 'next/cache';
import { getAdminUser } from '@/lib/data/admin';
import { extractYoutubeId } from '@/lib/data/video-clips';
import { buildNewsSlug } from '@/lib/openai/news-content';
import { createAdminClient } from '@/lib/supabase/admin';

type Result = { ok: boolean; message: string };

/** Catégories éditoriales autorisées. Doit rester aligné sur le prompt. */
export const NEWS_CATEGORIES = [
  'mercato',
  'avant_match',
  'blessure',
  'resultat',
  'club',
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<NewsCategory, string> = {
  mercato: 'Mercato',
  avant_match: 'Avant-match',
  blessure: 'Blessures',
  resultat: 'Résultats',
  club: 'Vie du club',
};

async function requireAdmin(): Promise<boolean> {
  const admin = await getAdminUser();
  return Boolean(admin);
}

/**
 * Met à jour un article.
 *
 * Le slug est recalculé quand le titre change : une URL doit correspondre au
 * titre qu'elle affiche. L'ancien slug n'est pas conservé — les articles ne
 * sont pas encore assez référencés pour justifier une table de redirections,
 * mais ce sera à prévoir si le trafic décolle.
 */
export async function updateNewsArticle(input: {
  id: number;
  title: string;
  slug: string;
  category: string;
  meta_description: string;
  ai_summary: string;
  ai_content: string;
  ai_perspective: string;
  video_url: string;
}): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: 'Accès refusé' };

  const title = input.title.trim();
  if (!title) return { ok: false, message: 'Titre requis' };

  if (
    input.category &&
    !(NEWS_CATEGORIES as readonly string[]).includes(input.category)
  ) {
    return { ok: false, message: 'Catégorie invalide' };
  }

  let videoId: string | null = null;
  if (input.video_url.trim()) {
    videoId = extractYoutubeId(input.video_url);
    if (!videoId) return { ok: false, message: 'URL YouTube non reconnue' };
  }

  // Slug : celui saisi s'il est fourni, sinon dérivé du titre.
  const slug = input.slug.trim() || buildNewsSlug(title, input.id);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('team_narratives')
    .update({
      title,
      slug,
      category: input.category || null,
      meta_description: input.meta_description.trim() || null,
      ai_summary: input.ai_summary.trim() || null,
      ai_content: input.ai_content.trim() || null,
      ai_perspective: input.ai_perspective.trim() || null,
      video_youtube_id: videoId,
      edited_at: new Date().toISOString(),
    })
    .eq('id', input.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/news');
  revalidatePath('/news');
  revalidatePath(`/news/${slug}`);
  return { ok: true, message: 'Article enregistré.' };
}

export async function setNewsStatus(
  id: number,
  status: 'draft' | 'published' | 'archived',
): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: 'Accès refusé' };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('team_narratives')
    .update({ status })
    .eq('id', id);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/news');
  revalidatePath('/news');
  return { ok: true, message: `Article passé en ${status}.` };
}

export async function deleteNewsArticle(id: number): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: 'Accès refusé' };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('team_narratives')
    .delete()
    .eq('id', id);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/news');
  revalidatePath('/news');
  return { ok: true, message: 'Article supprimé.' };
}

/**
 * Relance la rédaction IA d'un article.
 *
 * On vide `ai_content` : le cron de rédaction ne traite que les articles
 * dépourvus de contenu, il reprendra donc celui-ci à son prochain passage.
 * Régénérer en direct demanderait de dupliquer ici toute la construction du
 * contexte, pour un gain de quelques heures.
 */
export async function requeueNewsArticle(id: number): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: 'Accès refusé' };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('team_narratives')
    .update({ ai_content: null, ai_generated_at: null })
    .eq('id', id);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/news');
  return {
    ok: true,
    message: 'Article remis en file : il sera réécrit au prochain passage.',
  };
}
