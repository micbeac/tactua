'use server';

import { revalidatePath } from 'next/cache';
import { runGenerateContentAngles } from '@/lib/content/generate-content-angles';
import { getAdminUser } from '@/lib/data/admin';
import { createAdminClient } from '@/lib/supabase/admin';

type Result = { ok: true; message?: string } | { ok: false; message: string };

async function requireAdmin(): Promise<boolean> {
  const admin = await getAdminUser();
  return Boolean(admin && admin.is_admin);
}

/**
 * Déclenche la génération d'angles (pré + post match).
 * Si `matchId` est fourni, ne traite que ce match (force la régénération si
 * besoin). Sinon, le système sélectionne automatiquement les matchs
 * éligibles (post-match récents + pré-match J+48h sans angles).
 * Long ! À utiliser de préférence en local (next dev).
 */
export async function triggerGenerateAngles(
  matchId?: number | null,
): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: 'Accès refusé' };
  try {
    const supabase = createAdminClient();
    const stats = await runGenerateContentAngles(
      supabase,
      matchId != null && Number.isFinite(matchId)
        ? { matchIdFilter: matchId, force: true, limit: 1 }
        : { limit: 3 },
    );
    revalidatePath('/admin/contenu');
    const hint =
      stats.matches_processed === 0
        ? matchId != null
          ? "Match introuvable ou contexte indisponible."
          : 'Aucun match éligible pour l\'instant (pas de match fini récemment ni de match à venir dans les 48 h).'
        : `${stats.matches_processed} match(s) traité(s), ${stats.angles_inserted} angle(s) inséré(s)${
            stats.errors.length > 0 ? ` (${stats.errors.length} erreur(s))` : ''
          }.`;
    return { ok: true, message: hint };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Échec génération',
    };
  }
}

export async function validateAngle(id: number): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: 'Accès refusé' };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('content_angles')
    .update({
      status: 'validated',
      validated_at: new Date().toISOString(),
      rejected_reason: null,
    })
    .eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/contenu');
  return { ok: true };
}

export async function rejectAngle(
  id: number,
  reason: string,
): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: 'Accès refusé' };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('content_angles')
    .update({
      status: 'rejected',
      rejected_reason: reason.trim() || null,
    })
    .eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/contenu');
  return { ok: true };
}

export async function markAngleProduced(id: number): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: 'Accès refusé' };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('content_angles')
    .update({
      status: 'produced',
      produced_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/contenu');
  return { ok: true };
}

export async function markAnglePublished(
  id: number,
  urls: { tiktok?: string; instagram?: string; youtube?: string },
): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: 'Accès refusé' };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('content_angles')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      url_tiktok: urls.tiktok?.trim() || null,
      url_instagram: urls.instagram?.trim() || null,
      url_youtube: urls.youtube?.trim() || null,
    })
    .eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/contenu');
  return { ok: true };
}

export async function deleteAngle(id: number): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: 'Accès refusé' };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('content_angles')
    .delete()
    .eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/contenu');
  return { ok: true };
}
