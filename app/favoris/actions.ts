'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { FavoriteEntityType } from '@/lib/data/favorites';

const VALID_TYPES: readonly FavoriteEntityType[] = [
  'team',
  'player',
  'match',
  'competition',
];

export type ToggleFavoriteResult = {
  ok: boolean;
  is_favorite: boolean;
  error?: string;
};

/**
 * Bascule l'état favori pour une entité donnée :
 * - Si absent : INSERT (devient favori)
 * - Si présent : DELETE (retiré des favoris)
 * Requiert un user authentifié (sinon error).
 */
export async function toggleFavorite(
  entityType: FavoriteEntityType,
  entityId: number,
): Promise<ToggleFavoriteResult> {
  if (!VALID_TYPES.includes(entityType)) {
    return { ok: false, is_favorite: false, error: 'Type invalide.' };
  }
  if (!Number.isFinite(entityId)) {
    return { ok: false, is_favorite: false, error: 'ID invalide.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      ok: false,
      is_favorite: false,
      error: 'Connecte-toi pour ajouter aux favoris.',
    };
  }

  // Vérifie l'état actuel via une lecture (RLS s'occupe du filtrage par user).
  const { data: existing, error: readErr } = await supabase
    .from('user_favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle();

  if (readErr) {
    return { ok: false, is_favorite: false, error: readErr.message };
  }

  if (existing) {
    const { error: delErr } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);
    if (delErr) return { ok: false, is_favorite: true, error: delErr.message };
    revalidatePath('/favoris');
    return { ok: true, is_favorite: false };
  }

  const { error: insErr } = await supabase.from('user_favorites').insert({
    user_id: user.id,
    entity_type: entityType,
    entity_id: entityId,
  });
  if (insErr) return { ok: false, is_favorite: false, error: insErr.message };
  revalidatePath('/favoris');
  return { ok: true, is_favorite: true };
}
