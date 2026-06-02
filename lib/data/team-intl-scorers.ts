// Top buteurs internationaux d'une sélection nationale.
// Sert pour les pages match d'amicaux / qualifs / CDM et pour la fiche
// sélection. Pas de notion de « saison » : on prend les totaux carrière
// stockés dans national_team_squads (caps + goals + assists).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type IntlScorer = {
  player_id: number;
  name: string;
  position: string | null;
  intl_caps: number;
  intl_goals: number;
  intl_assists: number;
};

/**
 * Renvoie les top scoreurs en sélection (cumul carrière) pour une équipe.
 * Tri : buts DESC, puis sélections DESC.
 * Renvoie tableau vide si la team n'est pas une sélection nationale
 * (national_team_squads non peuplé pour cette team).
 */
export async function getTeamTopIntlScorers(
  supabase: Supa,
  teamId: number,
  limit = 5,
): Promise<IntlScorer[]> {
  const { data, error } = await supabase
    .from('national_team_squads')
    .select(
      `player_id, position, intl_caps, intl_goals, intl_assists,
       player:players!national_team_squads_player_id_fkey(id, name)`,
    )
    .eq('team_id', teamId)
    .order('intl_goals', { ascending: false })
    .limit(50);
  if (error) {
    console.error('[data] getTeamTopIntlScorers', error);
    return [];
  }

  type Row = {
    player_id: number;
    position: string | null;
    intl_caps: number | null;
    intl_goals: number | null;
    intl_assists: number | null;
    player: { id: number; name: string } | null;
  };

  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.player && (r.intl_goals ?? 0) > 0)
    .map((r) => ({
      player_id: r.player_id,
      name: r.player!.name,
      position: r.position,
      intl_caps: r.intl_caps ?? 0,
      intl_goals: r.intl_goals ?? 0,
      intl_assists: r.intl_assists ?? 0,
    }))
    .sort(
      (a, b) =>
        b.intl_goals - a.intl_goals || b.intl_caps - a.intl_caps,
    )
    .slice(0, limit);
}
