// Contexte de match calculé depuis notre base (zéro appel API) :
// fraîcheur / congestion du calendrier, et position au classement.
// Sert à enrichir le prompt de l'analyse pré-match.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

const DAY_MS = 24 * 60 * 60 * 1000;

export type TeamScheduleContext = {
  /** Jours de repos depuis le dernier match joué (null si aucun) */
  rest_days: number | null;
  /** Nombre de matchs joués dans les 14 jours précédant le coup d'envoi */
  matches_last_14d: number;
};

/**
 * Fraîcheur d'une équipe : repos depuis le dernier match + densité de
 * calendrier sur 2 semaines (toutes compétitions confondues).
 */
export async function getTeamScheduleContext(
  supabase: Supa,
  teamId: number,
  kickoffIso: string,
): Promise<TeamScheduleContext> {
  const kickoffMs = Date.parse(kickoffIso);
  const windowStart = new Date(kickoffMs - 14 * DAY_MS).toISOString();

  const { data } = await supabase
    .from('matches')
    .select('kickoff_at, status')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .lt('kickoff_at', kickoffIso)
    .in('status', ['finished', 'live'])
    .gte('kickoff_at', windowStart)
    .order('kickoff_at', { ascending: false });

  const rows = (data ?? []) as Array<{ kickoff_at: string; status: string }>;

  let restDays: number | null = null;
  if (rows.length > 0) {
    const last = Date.parse(rows[0].kickoff_at);
    restDays = Math.floor((kickoffMs - last) / DAY_MS);
  }

  return {
    rest_days: restDays,
    matches_last_14d: rows.length,
  };
}

export type StandingContext = {
  position: number;
  points: number;
  total_teams: number;
  /** Écart de points avec l'équipe juste au-dessus (null si 1er) */
  points_behind_above: number | null;
  /** Avance de points sur l'équipe juste en-dessous (null si dernier) */
  points_ahead_below: number | null;
};

/**
 * Position d'une équipe au classement d'une compétition + écarts avec ses
 * voisins directs. Source : team_season_stats (alimentée par le cron
 * refresh-rankings).
 */
export async function getStandingContext(
  supabase: Supa,
  competitionId: number,
  season: string,
  teamId: number,
): Promise<StandingContext | null> {
  const { data } = await supabase
    .from('team_season_stats')
    .select('team_id, points, position')
    .eq('competition_id', competitionId)
    .eq('season', season);

  const rows = (data ?? []) as Array<{
    team_id: number;
    points: number | null;
    position: number | null;
  }>;
  if (rows.length === 0) return null;

  // Tri par points décroissants (la colonne position peut être nulle/obsolète)
  const sorted = [...rows].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  const idx = sorted.findIndex((r) => r.team_id === teamId);
  if (idx === -1) return null;

  const me = sorted[idx];
  const above = idx > 0 ? sorted[idx - 1] : null;
  const below = idx < sorted.length - 1 ? sorted[idx + 1] : null;
  const myPts = me.points ?? 0;

  return {
    position: idx + 1,
    points: myPts,
    total_teams: sorted.length,
    points_behind_above: above ? (above.points ?? 0) - myPts : null,
    points_ahead_below: below ? myPts - (below.points ?? 0) : null,
  };
}

export type TeamSeasonXG = {
  /** Nombre de matchs avec xG disponible */
  sample: number;
  /** xG marqué par match (moyenne) */
  xg_for_avg: number;
  /** xG concédé par match (moyenne) */
  xg_against_avg: number;
};

/**
 * xG saison d'une équipe dans une compétition : moyenne du xG marqué et
 * concédé sur ses matchs finis (jusqu'à 40 récents). Source :
 * match_team_stats.expected_goals. Renvoie null si aucun xG disponible.
 */
export async function getTeamSeasonXG(
  supabase: Supa,
  teamId: number,
  competitionId: number,
): Promise<TeamSeasonXG | null> {
  const { data: matchRows } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id')
    .eq('competition_id', competitionId)
    .eq('status', 'finished')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order('kickoff_at', { ascending: false })
    .limit(40);

  const matches = (matchRows ?? []) as Array<{
    id: number;
    home_team_id: number | null;
    away_team_id: number | null;
  }>;
  if (matches.length === 0) return null;

  const { data: statRows } = await supabase
    .from('match_team_stats')
    .select('match_id, team_id, expected_goals')
    .in(
      'match_id',
      matches.map((m) => m.id),
    );

  const byMatch = new Map<
    number,
    Array<{ team_id: number; xg: number | null }>
  >();
  for (const s of (statRows ?? []) as Array<{
    match_id: number;
    team_id: number;
    expected_goals: number | null;
  }>) {
    const list = byMatch.get(s.match_id) ?? [];
    list.push({ team_id: s.team_id, xg: s.expected_goals });
    byMatch.set(s.match_id, list);
  }

  let forSum = 0;
  let againstSum = 0;
  let n = 0;
  for (const m of matches) {
    const rows = byMatch.get(m.id);
    if (!rows) continue;
    const mine = rows.find((r) => r.team_id === teamId);
    const opp = rows.find((r) => r.team_id !== teamId);
    if (mine?.xg == null || opp?.xg == null) continue;
    forSum += mine.xg;
    againstSum += opp.xg;
    n += 1;
  }
  if (n === 0) return null;

  return {
    sample: n,
    xg_for_avg: Math.round((forSum / n) * 100) / 100,
    xg_against_avg: Math.round((againstSum / n) * 100) / 100,
  };
}
