import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type LocationSplit = {
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
};

export type HalfSplit = {
  /** Matchs pour lesquels on a un score mi-temps */
  matches_played: number;
  goals_for: number;
  goals_against: number;
};

export type TeamSplits = {
  /** Bilan à domicile (matchs joués finished) */
  home: LocationSplit;
  /** Bilan à l'extérieur */
  away: LocationSplit;
  /** Mi-temps 1 : buts marqués/encaissés cumulés */
  first_half: HalfSplit;
  /** Mi-temps 2 */
  second_half: HalfSplit;
};

/**
 * Calcule les stats par tranche (domicile/extérieur + mi-temps) pour une
 * équipe sur tous ses matchs `finished` en DB.
 */
export async function getTeamSplits(
  supabase: Supa,
  teamId: number,
): Promise<TeamSplits> {
  const { data } = await supabase
    .from('matches')
    .select(
      'home_team_id, away_team_id, score_home, score_away, half_time_home, half_time_away',
    )
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq('status', 'finished');

  type Row = {
    home_team_id: number;
    away_team_id: number;
    score_home: number | null;
    score_away: number | null;
    half_time_home: number | null;
    half_time_away: number | null;
  };

  const home: LocationSplit = {
    matches_played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
  };
  const away: LocationSplit = {
    matches_played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
  };
  const firstHalf: HalfSplit = {
    matches_played: 0,
    goals_for: 0,
    goals_against: 0,
  };
  const secondHalf: HalfSplit = {
    matches_played: 0,
    goals_for: 0,
    goals_against: 0,
  };

  for (const r of (data ?? []) as Row[]) {
    if (r.score_home == null || r.score_away == null) continue;
    const isHome = r.home_team_id === teamId;
    const goalsFor = isHome ? r.score_home : r.score_away;
    const goalsAgainst = isHome ? r.score_away : r.score_home;
    const target = isHome ? home : away;
    target.matches_played += 1;
    target.goals_for += goalsFor;
    target.goals_against += goalsAgainst;
    if (goalsFor > goalsAgainst) target.wins += 1;
    else if (goalsFor < goalsAgainst) target.losses += 1;
    else target.draws += 1;

    // Mi-temps : nécessite half_time data
    if (r.half_time_home == null || r.half_time_away == null) continue;
    const ht_for = isHome ? r.half_time_home : r.half_time_away;
    const ht_against = isHome ? r.half_time_away : r.half_time_home;
    const ft_for = goalsFor;
    const ft_against = goalsAgainst;

    firstHalf.matches_played += 1;
    firstHalf.goals_for += ht_for;
    firstHalf.goals_against += ht_against;
    secondHalf.matches_played += 1;
    secondHalf.goals_for += ft_for - ht_for;
    secondHalf.goals_against += ft_against - ht_against;
  }

  return { home, away, first_half: firstHalf, second_half: secondHalf };
}
