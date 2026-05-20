import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type PlayerRow = {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  current_team_id: number | null;
  photo_url: string | null;
  shirt_number: number | null;
  current_team: {
    id: number;
    name: string;
    tla: string | null;
    logo_url: string | null;
    country: string | null;
  } | null;
};

export async function getPlayer(
  supabase: Supa,
  id: number,
): Promise<PlayerRow | null> {
  const { data, error } = await supabase
    .from('players')
    .select(
      `id, name, first_name, last_name, position, nationality, date_of_birth,
       current_team_id, photo_url, shirt_number,
       current_team:teams!players_current_team_id_fkey(id, name, tla, logo_url, country)`,
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[data/player] getPlayer', error);
    return null;
  }
  return (data as unknown as PlayerRow | null) ?? null;
}

export type PlayerSeasonStatsRow = {
  competition_id: number;
  season: string;
  appearances: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  competition: { id: number; name: string } | null;
};

export async function getPlayerSeasonStats(
  supabase: Supa,
  playerId: number,
): Promise<PlayerSeasonStatsRow[]> {
  const { data, error } = await supabase
    .from('player_season_stats')
    .select(
      `competition_id, season, appearances, minutes, goals, assists,
       yellow_cards, red_cards,
       competition:competitions(id, name)`,
    )
    .eq('player_id', playerId)
    .order('season', { ascending: false });
  if (error) {
    console.error('[data/player] season stats', error);
    return [];
  }
  return (data ?? []) as unknown as PlayerSeasonStatsRow[];
}

export type PlayerMatchPerformance = {
  match_id: number;
  minutes_played: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  passes: number | null;
  key_passes: number | null;
  yellow_card: boolean | null;
  red_card: boolean | null;
  rating: number | null;
  match: {
    id: number;
    kickoff_at: string;
    score_home: number | null;
    score_away: number | null;
    home_team_id: number | null;
    away_team_id: number | null;
    competition: { id: number; name: string } | null;
    home_team: { id: number; name: string; tla: string | null } | null;
    away_team: { id: number; name: string; tla: string | null } | null;
  } | null;
};

export async function getPlayerRecentPerformances(
  supabase: Supa,
  playerId: number,
  limit = 5,
): Promise<PlayerMatchPerformance[]> {
  const { data, error } = await supabase
    .from('match_player_stats')
    .select(
      `match_id, minutes_played, goals, assists, shots, passes, key_passes,
       yellow_card, red_card, rating,
       match:matches(id, kickoff_at, score_home, score_away, home_team_id, away_team_id,
         competition:competitions(id, name),
         home_team:teams!matches_home_team_id_fkey(id, name, tla),
         away_team:teams!matches_away_team_id_fkey(id, name, tla))`,
    )
    .eq('player_id', playerId)
    .order('match_id', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[data/player] recent perf', error);
    return [];
  }
  return (data ?? []) as unknown as PlayerMatchPerformance[];
}
