// Construit un map player_id → PlayerPopupData pour tous les joueurs
// impliqués dans un match (lineup + events). Utilisé par les sections
// Lineup et Timeline pour ouvrir un popup riche au lieu de naviguer
// directement vers la fiche joueur.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlayerPopupData } from '@/components/match/PlayerPopup';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export async function getMatchPlayerPopupMap(
  supabase: Supa,
  matchId: number,
  homeTeamId: number | null,
  awayTeamId: number | null,
): Promise<Map<number, PlayerPopupData>> {
  const result = new Map<number, PlayerPopupData>();

  // 1. Récupère tous les player_ids impliqués (lineup + events)
  const playerIds = new Set<number>();

  const [lineupsRes, eventsRes] = await Promise.all([
    supabase
      .from('match_lineups')
      .select('player_id, team_id, position, shirt_number, is_starter')
      .eq('match_id', matchId),
    supabase
      .from('match_events')
      .select('player_id, assist_player_id, team_id')
      .eq('match_id', matchId),
  ]);

  const lineupRows = (lineupsRes.data ?? []) as Array<{
    player_id: number;
    team_id: number | null;
    position: string | null;
    shirt_number: number | null;
    is_starter: boolean;
  }>;
  const eventRows = (eventsRes.data ?? []) as Array<{
    player_id: number | null;
    assist_player_id: number | null;
    team_id: number | null;
  }>;

  // Map lineup-info par player_id (position + shirt_number)
  const lineupInfoById = new Map<
    number,
    { position: string | null; shirt_number: number | null; team_id: number | null }
  >();
  for (const r of lineupRows) {
    playerIds.add(r.player_id);
    lineupInfoById.set(r.player_id, {
      position: r.position,
      shirt_number: r.shirt_number,
      team_id: r.team_id,
    });
  }
  for (const r of eventRows) {
    if (r.player_id != null) playerIds.add(r.player_id);
    if (r.assist_player_id != null) playerIds.add(r.assist_player_id);
  }

  if (playerIds.size === 0) return result;

  // 2. Récupère info joueurs (photo, nom, position, date_naissance)
  const ids = Array.from(playerIds);
  const { data: players } = await supabase
    .from('players')
    .select(
      'id, name, photo_url, position, current_team_id, date_of_birth, nationality',
    )
    .in('id', ids);

  type PlayerRow = {
    id: number;
    name: string;
    photo_url: string | null;
    position: string | null;
    current_team_id: number | null;
    date_of_birth: string | null;
    nationality: string | null;
  };
  const playerById = new Map<number, PlayerRow>();
  for (const p of (players ?? []) as PlayerRow[]) {
    playerById.set(p.id, p);
  }

  // 3. Récupère les stats du match pour ces joueurs
  const { data: stats } = await supabase
    .from('match_player_stats')
    .select(
      'player_id, minutes_played, rating, goals, assists, shots, key_passes, passes',
    )
    .eq('match_id', matchId)
    .in('player_id', ids);

  type StatRow = {
    player_id: number;
    minutes_played: number | null;
    rating: number | null;
    goals: number | null;
    assists: number | null;
    shots: number | null;
    key_passes: number | null;
    passes: number | null;
  };
  const statById = new Map<number, StatRow>();
  for (const s of (stats ?? []) as StatRow[]) {
    statById.set(s.player_id, s);
  }

  // 4. Build le map final
  for (const id of ids) {
    const p = playerById.get(id);
    if (!p) continue;
    const lineup = lineupInfoById.get(id);
    const stat = statById.get(id);
    result.set(id, {
      name: p.name,
      photo: p.photo_url,
      position: lineup?.position ?? p.position,
      db_player_id: id,
      shirt_number: lineup?.shirt_number ?? null,
      date_of_birth: p.date_of_birth,
      nationality: p.nationality,
      appearances:
        stat?.minutes_played != null && stat.minutes_played > 0
          ? 1
          : undefined,
      goals: stat?.goals ?? undefined,
      assists: stat?.assists ?? undefined,
      rating: stat?.rating ?? null,
      shots_on_target: stat?.shots ?? null,
      key_passes: stat?.key_passes ?? null,
      passes_accuracy: null, // pas dispo dans cette table (champ passes = total)
    });
  }

  return result;
}
