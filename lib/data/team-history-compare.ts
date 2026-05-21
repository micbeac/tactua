// Comparaison historique multi-saisons entre deux équipes.
// Récupère toutes les saisons disponibles dans team_season_stats
// pour chacune des deux équipes, alignées par saison.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type SeasonSnapshot = {
  season: string;
  competition_name: string | null;
  position: number | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
};

export type TeamHistoryCompare = {
  /** Toutes les saisons présentes (union), triées du + ancien au + récent */
  seasons: string[];
  /** Stats team_a indexées par saison */
  a_by_season: Record<string, SeasonSnapshot>;
  /** Stats team_b indexées par saison */
  b_by_season: Record<string, SeasonSnapshot>;
};

type Row = {
  season: string;
  position: number | null;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goals_for: number | null;
  goals_against: number | null;
  goal_difference: number | null;
  points: number | null;
  competition: { name: string } | null;
};

function toSnapshot(r: Row): SeasonSnapshot {
  return {
    season: r.season,
    competition_name: r.competition?.name ?? null,
    position: r.position,
    played: r.played ?? 0,
    wins: r.wins ?? 0,
    draws: r.draws ?? 0,
    losses: r.losses ?? 0,
    goals_for: r.goals_for ?? 0,
    goals_against: r.goals_against ?? 0,
    goal_difference: r.goal_difference ?? 0,
    points: r.points ?? 0,
  };
}

/**
 * Pour une équipe, retourne la meilleure ligne (par points décroissants)
 * de chaque saison où elle a joué.
 */
function pickBestPerSeason(rows: Row[]): Record<string, SeasonSnapshot> {
  const out: Record<string, SeasonSnapshot> = {};
  for (const r of rows) {
    const snap = toSnapshot(r);
    const existing = out[r.season];
    if (!existing || snap.points > existing.points) {
      out[r.season] = snap;
    }
  }
  return out;
}

export async function getTeamHistoryCompare(
  supabase: Supa,
  teamAId: number,
  teamBId: number,
): Promise<TeamHistoryCompare> {
  const [resA, resB] = await Promise.all([
    supabase
      .from('team_season_stats')
      .select(
        'season, position, played, wins, draws, losses, goals_for, goals_against, goal_difference, points, competition:competitions(name)',
      )
      .eq('team_id', teamAId)
      .order('season', { ascending: false }),
    supabase
      .from('team_season_stats')
      .select(
        'season, position, played, wins, draws, losses, goals_for, goals_against, goal_difference, points, competition:competitions(name)',
      )
      .eq('team_id', teamBId)
      .order('season', { ascending: false }),
  ]);

  const rowsA = (resA.data ?? []) as unknown as Row[];
  const rowsB = (resB.data ?? []) as unknown as Row[];

  const a = pickBestPerSeason(rowsA);
  const b = pickBestPerSeason(rowsB);

  // Union saisons triées du + ancien au + récent
  const seasonSet = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  const seasons = Array.from(seasonSet).sort();

  return { seasons, a_by_season: a, b_by_season: b };
}
