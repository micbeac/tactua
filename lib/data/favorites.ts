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

export type PersonalUpcomingMatch = {
  id: number;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  stage: string | null;
  matchday: number | null;
  score_home: number | null;
  score_away: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team: {
    id: number;
    name: string;
    tla: string | null;
    logo_url: string | null;
  } | null;
  away_team: {
    id: number;
    name: string;
    tla: string | null;
    logo_url: string | null;
  } | null;
};

/**
 * Matchs à venir (ou live) où l'une des équipes favorites de l'utilisateur joue,
 * OU qui sont eux-mêmes favoris. Ordonnés par kickoff_at ASC.
 * Renvoie [] si pas de favoris.
 */
export async function getPersonalUpcomingMatches(
  supabase: Supa,
  userId: string,
  limit = 8,
): Promise<PersonalUpcomingMatch[]> {
  const favs = await getUserFavorites(supabase, userId);
  const teamIds = favs
    .filter((f) => f.entity_type === 'team')
    .map((f) => f.entity_id);
  const matchIds = favs
    .filter((f) => f.entity_type === 'match')
    .map((f) => f.entity_id);

  if (teamIds.length === 0 && matchIds.length === 0) return [];

  const filters: string[] = [];
  if (teamIds.length) {
    filters.push(`home_team_id.in.(${teamIds.join(',')})`);
    filters.push(`away_team_id.in.(${teamIds.join(',')})`);
  }
  if (matchIds.length) {
    filters.push(`id.in.(${matchIds.join(',')})`);
  }
  const orFilter = filters.join(',');

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('matches')
    .select(
      `id, kickoff_at, status, stage, matchday, score_home, score_away,
       home_team_id, away_team_id,
       home_team:teams!matches_home_team_id_fkey(id, name, tla, logo_url),
       away_team:teams!matches_away_team_id_fkey(id, name, tla, logo_url)`,
    )
    .or(orFilter)
    .in('status', ['scheduled', 'live'])
    .gte('kickoff_at', now)
    .order('kickoff_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[data/favorites] personal upcoming', error);
    return [];
  }
  return (data ?? []) as unknown as PersonalUpcomingMatch[];
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
