'use server';

import { revalidatePath } from 'next/cache';
import { getAdminUser } from '@/lib/data/admin';
import { extractYoutubeId } from '@/lib/data/video-clips';
import { runRefreshWCNews } from '@/lib/news/refresh-wc-news';
import { createAdminClient } from '@/lib/supabase/admin';

type Result = { ok: true; message?: string } | { ok: false; message: string };

async function requireAdmin(): Promise<boolean> {
  const admin = await getAdminUser();
  return Boolean(admin && admin.is_admin);
}

/**
 * Lance le scraping des news CDM (insertion en draft + rédaction IA).
 * ⚠ Opération longue : fiable en local (admin lancé via `next dev`, sans
 * timeout). En production Vercel, préférer le script scripts/refresh-wc-news.ts.
 */
export async function triggerWCNewsScrape(): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: 'Accès refusé' };
  try {
    const supabase = createAdminClient();
    const stats = await runRefreshWCNews(supabase, {});
    revalidatePath('/admin/wc-news');
    return {
      ok: true,
      message: `${stats.articles_inserted} articles récupérés, ${stats.ai_generated} rédigés par l'IA${
        stats.ai_failed > 0 ? ` (${stats.ai_failed} échecs)` : ''
      }.`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Échec du scraping',
    };
  }
}

export async function updateWCNewsArticle(input: {
  id: number;
  title: string;
  category: string;
  ai_summary: string;
  ai_content: string;
  ai_perspective: string;
  video_url: string;
}): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: 'Accès refusé' };

  if (!input.title.trim()) return { ok: false, message: 'Titre requis' };
  if (!['selection', 'tournoi'].includes(input.category)) {
    return { ok: false, message: 'Catégorie invalide' };
  }

  // Vidéo optionnelle : si une URL est fournie, elle doit être valide.
  let videoId: string | null = null;
  if (input.video_url.trim()) {
    videoId = extractYoutubeId(input.video_url);
    if (!videoId) return { ok: false, message: 'URL YouTube non reconnue' };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('wc_news')
    .update({
      title: input.title.trim(),
      category: input.category,
      ai_summary: input.ai_summary.trim() || null,
      ai_content: input.ai_content.trim() || null,
      ai_perspective: input.ai_perspective.trim() || null,
      video_youtube_id: videoId,
      edited_at: new Date().toISOString(),
    })
    .eq('id', input.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/wc-news');
  return { ok: true, message: 'Article enregistré.' };
}

export async function setWCNewsStatus(
  id: number,
  status: 'draft' | 'published' | 'archived',
): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: 'Accès refusé' };

  const supabase = createAdminClient();
  const patch: { status: typeof status; published_at?: string } = { status };
  // Date de publication posée au premier passage en 'published'.
  if (status === 'published') {
    const { data: existing } = await supabase
      .from('wc_news')
      .select('published_at')
      .eq('id', id)
      .maybeSingle();
    if (!existing?.published_at) {
      patch.published_at = new Date().toISOString();
    }
  }
  const { error } = await supabase.from('wc_news').update(patch).eq('id', id);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/wc-news');
  revalidatePath('/coupe-du-monde-2026/actu');
  revalidatePath('/coupe-du-monde-2026');
  return { ok: true };
}

export async function deleteWCNewsArticle(id: number): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: 'Accès refusé' };

  const supabase = createAdminClient();
  const { error } = await supabase.from('wc_news').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/wc-news');
  return { ok: true };
}
