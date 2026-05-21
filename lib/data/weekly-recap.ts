import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getUserFavorites } from '@/lib/data/favorites';

type Supa = SupabaseClient<Database>;

export type FavoritePerspective = {
  /** Match id pour lien */
  match_id: number;
  /** Date ISO */
  date: string;
  competition_name: string | null;
  /** Équipe favorite affichée */
  favorite_team: { id: number; name: string; tla: string | null };
  /** Adversaire */
  opponent: { id: number; name: string; tla: string | null };
  /** Score équipe favorite — équipe favorite — adversaire */
  goals_for: number;
  goals_against: number;
  result: 'W' | 'D' | 'L';
  /** True si l'équipe favorite jouait à domicile */
  was_home: boolean;
};

export type WeeklyRecap = {
  period_start_iso: string;
  period_end_iso: string;
  /** Matchs joués par les équipes favorites cette semaine */
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  /** Meilleur résultat (plus gros écart positif) */
  best_result: FavoritePerspective | null;
  /** Pire résultat (plus gros écart négatif) */
  worst_result: FavoritePerspective | null;
  /** Tous les résultats ordonnés du + récent au + ancien */
  results: FavoritePerspective[];
};

/**
 * Bilan des 7 derniers jours pour les équipes favorites de l'utilisateur.
 */
export async function getWeeklyRecap(
  supabase: Supa,
  userId: string,
): Promise<WeeklyRecap> {
  const favs = await getUserFavorites(supabase, userId);
  const teamIds = favs
    .filter((f) => f.entity_type === 'team')
    .map((f) => f.entity_id);
  const matchIds = favs
    .filter((f) => f.entity_type === 'match')
    .map((f) => f.entity_id);

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);

  const empty: WeeklyRecap = {
    period_start_iso: start.toISOString(),
    period_end_iso: end.toISOString(),
    matches_played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    best_result: null,
    worst_result: null,
    results: [],
  };

  if (teamIds.length === 0 && matchIds.length === 0) return empty;

  const filters: string[] = [];
  if (teamIds.length > 0) {
    filters.push(`home_team_id.in.(${teamIds.join(',')})`);
    filters.push(`away_team_id.in.(${teamIds.join(',')})`);
  }
  if (matchIds.length > 0) {
    filters.push(`id.in.(${matchIds.join(',')})`);
  }

  const { data: rows } = await supabase
    .from('matches')
    .select(
      `id, kickoff_at, home_team_id, away_team_id, score_home, score_away,
       competition:competitions(name),
       home_team:teams!matches_home_team_id_fkey(id, name, tla),
       away_team:teams!matches_away_team_id_fkey(id, name, tla)`,
    )
    .or(filters.join(','))
    .eq('status', 'finished')
    .gte('kickoff_at', start.toISOString())
    .lte('kickoff_at', end.toISOString())
    .order('kickoff_at', { ascending: false });

  type Row = {
    id: number;
    kickoff_at: string;
    home_team_id: number | null;
    away_team_id: number | null;
    score_home: number | null;
    score_away: number | null;
    competition: { name: string } | null;
    home_team: { id: number; name: string; tla: string | null } | null;
    away_team: { id: number; name: string; tla: string | null } | null;
  };

  const teamSet = new Set(teamIds);
  const results: FavoritePerspective[] = [];

  for (const r of (rows ?? []) as Row[]) {
    if (
      r.score_home == null ||
      r.score_away == null ||
      !r.home_team ||
      !r.away_team
    ) {
      continue;
    }
    // Détermine la perspective : si l'équipe domicile est favorite, on prend
    // cette perspective. Sinon l'équipe extérieure. (Si les 2 sont favorites
    // → on prend home par défaut, on duplique pour comptabiliser les 2.)
    const homeIsFav = teamSet.has(r.home_team.id);
    const awayIsFav = teamSet.has(r.away_team.id);
    if (!homeIsFav && !awayIsFav) {
      // Match favori uniquement (entité 'match'), pas d'équipe favorite
      // → on prend la perspective home par défaut
      results.push(buildPerspective(r, true));
      continue;
    }
    if (homeIsFav) results.push(buildPerspective(r, true));
    if (awayIsFav) results.push(buildPerspective(r, false));
  }

  const wins = results.filter((r) => r.result === 'W').length;
  const draws = results.filter((r) => r.result === 'D').length;
  const losses = results.filter((r) => r.result === 'L').length;
  const goals_for = results.reduce((s, r) => s + r.goals_for, 0);
  const goals_against = results.reduce((s, r) => s + r.goals_against, 0);

  // Meilleur résultat : plus gros écart positif
  const sorted = [...results];
  sorted.sort((a, b) => b.goals_for - b.goals_against - (a.goals_for - a.goals_against));
  const best = sorted.length > 0 ? sorted[0] : null;
  const worst = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  return {
    period_start_iso: start.toISOString(),
    period_end_iso: end.toISOString(),
    matches_played: results.length,
    wins,
    draws,
    losses,
    goals_for,
    goals_against,
    best_result:
      best && best.goals_for - best.goals_against > 0 ? best : null,
    worst_result:
      worst && worst.goals_for - worst.goals_against < 0 ? worst : null,
    results,
  };
}

function buildPerspective(
  r: {
    id: number;
    kickoff_at: string;
    score_home: number | null;
    score_away: number | null;
    competition: { name: string } | null;
    home_team: { id: number; name: string; tla: string | null } | null;
    away_team: { id: number; name: string; tla: string | null } | null;
  },
  fromHomePerspective: boolean,
): FavoritePerspective {
  const home = r.home_team!;
  const away = r.away_team!;
  const sh = r.score_home!;
  const sa = r.score_away!;
  const fav = fromHomePerspective ? home : away;
  const opp = fromHomePerspective ? away : home;
  const goalsFor = fromHomePerspective ? sh : sa;
  const goalsAgainst = fromHomePerspective ? sa : sh;
  let result: 'W' | 'D' | 'L';
  if (goalsFor > goalsAgainst) result = 'W';
  else if (goalsFor < goalsAgainst) result = 'L';
  else result = 'D';
  return {
    match_id: r.id,
    date: r.kickoff_at,
    competition_name: r.competition?.name ?? null,
    favorite_team: fav,
    opponent: opp,
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    result,
    was_home: fromHomePerspective,
  };
}
