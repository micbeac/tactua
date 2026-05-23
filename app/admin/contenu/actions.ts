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
 * Déclenche la génération d'angles (pré + post match) pour les matchs
 * éligibles. Long ! À utiliser de préférence en local (next dev).
 */
export async function triggerGenerateAngles(): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: 'Accès refusé' };
  try {
    const supabase = createAdminClient();
    const stats = await runGenerateContentAngles(supabase, { limit: 3 });
    revalidatePath('/admin/contenu');
    return {
      ok: true,
      message: `${stats.matches_processed} matchs traités, ${stats.angles_inserted} angles insérés${
        stats.errors.length > 0 ? ` (${stats.errors.length} erreurs)` : ''
      }.`,
    };
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
