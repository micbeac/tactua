import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type FavoriteEntityType = 'team' | 'player' | 'match' | 'competition';

export type FavoriteRow = {
  entity_type: FavoriteEntityType;
  entity_id: number;
  created_at: string;
};

export async function getUserFavorites(
  supabase: Supa,
  userId: string,
): Promise<FavoriteRow[]> {
  const { data, error } = await supabase
    .from('user_favorites')
    .select('entity_type, entity_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[data/favorites] getUserFavorites', error);
    return [];
  }
  return (data ?? []) as FavoriteRow[];
}

/**
 * Vérifie si une entité précise est dans les favoris de l'utilisateur.
 * Retourne false si pas connecté.
 */
export async function isFavorite(
  supabase: Supa,
  userId: string | null,
  type: FavoriteEntityType,
  id: number,
): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase
    .from('user_favorites')
    .select('entity_id')
    .eq('user_id', userId)
    .eq('entity_type', type)
    .eq('entity_id', id)
    .maybeSingle();
  if (error) {
    console.error('[data/favorites] isFavorite', error);
    return false;
  }
  return Boolean(data);
}
