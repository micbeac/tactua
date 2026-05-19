import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Helpers de queries spécifiques à la fiche match.
// Utilisés depuis des Server Components ; le client Supabase est passé en
// paramètre (anon ou service_role selon le contexte) pour rester testable.

type Supa = SupabaseClient<Database>;

export type H2HRow = {
  id: number;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  home_team_id: number | null;
  away_team_id: number | null;
  score_home: number | null;
  score_away: number | null;
  competition: { id: number; name: string } | null;
};

const H2H_SELECT = `
  id, kickoff_at, status, home_team_id, away_team_id, score_home, score_away,
  competition:competitions(id, name)
`;

/**
 * Renvoie jusqu'à `limit` confrontations passées entre deux équipes,
 * status = 'finished', triées du plus récent au plus ancien.
 * Le match en cours (excludeMatchId) est exclu pour éviter l'auto-référence.
 */
export async function getHeadToHead(
  supabase: Supa,
  teamA: number,
  teamB: number,
  excludeMatchId: number,
  limit = 5,
): Promise<H2HRow[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(H2H_SELECT)
    .eq('status', 'finished')
    .neq('id', excludeMatchId)
    .or(
      `and(home_team_id.eq.${teamA},away_team_id.eq.${teamB}),and(home_team_id.eq.${teamB},away_team_id.eq.${teamA})`,
    )
    .order('kickoff_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[data] H2H query error', error);
    return [];
  }
  return (data ?? []) as unknown as H2HRow[];
}

export type FormResult = 'W' | 'D' | 'L';

export type FormMatch = {
  id: number;
  kickoff_at: string;
  result: FormResult;
  score_for: number | null;
  score_against: number | null;
  opponent_id: number | null;
  was_home: boolean;
};

/**
 * Calcule la forme récente d'une équipe : `limit` derniers matchs finis,
 * du plus récent au plus ancien, avec résultat W/D/L du point de vue de teamId.
 * Le match courant est exclu.
 */
export async function getTeamForm(
  supabase: Supa,
  teamId: number,
  excludeMatchId: number,
  limit = 5,
): Promise<FormMatch[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, kickoff_at, home_team_id, away_team_id, score_home, score_away',
    )
    .eq('status', 'finished')
    .neq('id', excludeMatchId)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order('kickoff_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[data] form query error', error);
    return [];
  }

  return (data ?? []).map((m) => {
    const wasHome = m.home_team_id === teamId;
    const scoreFor = wasHome ? m.score_home : m.score_away;
    const scoreAgainst = wasHome ? m.score_away : m.score_home;
    let result: FormResult = 'D';
    if (scoreFor != null && scoreAgainst != null) {
      if (scoreFor > scoreAgainst) result = 'W';
      else if (scoreFor < scoreAgainst) result = 'L';
    }
    return {
      id: m.id,
      kickoff_at: m.kickoff_at,
      result,
      score_for: scoreFor,
      score_against: scoreAgainst,
      opponent_id: wasHome ? m.away_team_id : m.home_team_id,
      was_home: wasHome,
    };
  });
}

export type MatchTeamStatsRow = {
  team_id: number;
  possession: number | null;
  shots: number | null;
  shots_on_target: number | null;
  corners: number | null;
  fouls: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  offsides: number | null;
};

export async function getMatchTeamStats(
  supabase: Supa,
  matchId: number,
): Promise<MatchTeamStatsRow[]> {
  const { data, error } = await supabase
    .from('match_team_stats')
    .select(
      'team_id, possession, shots, shots_on_target, corners, fouls, yellow_cards, red_cards, offsides',
    )
    .eq('match_id', matchId);
  if (error) {
    console.error('[data] team stats query error', error);
    return [];
  }
  return (data ?? []) as MatchTeamStatsRow[];
}
