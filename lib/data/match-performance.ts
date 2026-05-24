// Contexte de performance post-match : meilleurs joueurs (par note) et
// buteurs, avec leurs noms. Sert à enrichir le prompt de l'analyse
// post-match pour que l'IA puisse nommer l'homme du match.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type MatchPerformer = {
  name: string;
  rating: number | null;
  goals: number;
  assists: number;
  minutes: number | null;
};

export type MatchGoalEvent = {
  minute: number;
  scorer: string;
  assist: string | null;
  detail: string | null; // 'Normal Goal', 'Penalty', 'Own Goal'...
  team_side: 'home' | 'away';
};

export type PostMatchPerformance = {
  home_performers: MatchPerformer[];
  away_performers: MatchPerformer[];
  goal_events: MatchGoalEvent[];
};

const EMPTY: PostMatchPerformance = {
  home_performers: [],
  away_performers: [],
  goal_events: [],
};

/**
 * Charge les notes/buts/passes des joueurs + les buts du match.
 * Renvoie le top 6 des joueurs par note pour chaque équipe + la liste
 * chronologique des buts.
 */
export async function getPostMatchPerformance(
  supabase: Supa,
  matchId: number,
  homeTeamId: number | null,
  awayTeamId: number | null,
  options: { top_n?: number | null } = {},
): Promise<PostMatchPerformance> {
  const [statsRes, lineupsRes, eventsRes] = await Promise.all([
    supabase
      .from('match_player_stats')
      .select('player_id, rating, goals, assists, minutes_played')
      .eq('match_id', matchId),
    supabase
      .from('match_lineups')
      .select('player_id, team_id')
      .eq('match_id', matchId),
    supabase
      .from('match_events')
      .select('minute, extra_minute, type, detail, team_id, player_id, assist_player_id')
      .eq('match_id', matchId)
      .eq('type', 'goal'),
  ]);

  type StatRow = {
    player_id: number;
    rating: number | null;
    goals: number | null;
    assists: number | null;
    minutes_played: number | null;
  };
  type LineupRow = { player_id: number; team_id: number | null };
  type EventRow = {
    minute: number | null;
    extra_minute: number | null;
    type: string;
    detail: string | null;
    team_id: number | null;
    player_id: number | null;
    assist_player_id: number | null;
  };

  const stats = (statsRes.data ?? []) as StatRow[];
  const lineups = (lineupsRes.data ?? []) as LineupRow[];
  const events = (eventsRes.data ?? []) as EventRow[];

  if (stats.length === 0 && events.length === 0) return EMPTY;

  // player_id → team_id (via compos)
  const teamByPlayer = new Map<number, number>();
  for (const l of lineups) {
    if (l.team_id != null) teamByPlayer.set(l.player_id, l.team_id);
  }

  // Tous les player_ids à nommer
  const ids = new Set<number>();
  for (const s of stats) ids.add(s.player_id);
  for (const e of events) {
    if (e.player_id != null) ids.add(e.player_id);
    if (e.assist_player_id != null) ids.add(e.assist_player_id);
  }
  if (ids.size === 0) return EMPTY;

  const { data: playersData } = await supabase
    .from('players')
    .select('id, name')
    .in('id', [...ids]);
  const nameById = new Map<number, string>();
  for (const p of (playersData ?? []) as Array<{ id: number; name: string }>) {
    nameById.set(p.id, p.name);
  }

  // Top performers par équipe (note décroissante)
  const homePerf: MatchPerformer[] = [];
  const awayPerf: MatchPerformer[] = [];
  for (const s of stats) {
    const name = nameById.get(s.player_id);
    if (!name) continue;
    const teamId = teamByPlayer.get(s.player_id);
    const perf: MatchPerformer = {
      name,
      rating: s.rating,
      goals: s.goals ?? 0,
      assists: s.assists ?? 0,
      minutes: s.minutes_played,
    };
    if (teamId != null && teamId === homeTeamId) homePerf.push(perf);
    else if (teamId != null && teamId === awayTeamId) awayPerf.push(perf);
  }
  const byRating = (a: MatchPerformer, b: MatchPerformer) =>
    (b.rating ?? 0) - (a.rating ?? 0);
  homePerf.sort(byRating);
  awayPerf.sort(byRating);

  // Buts dans l'ordre chronologique
  const goalEvents: MatchGoalEvent[] = events
    .filter((e) => e.minute != null && e.player_id != null)
    .map((e) => {
      const scorer = nameById.get(e.player_id!) ?? 'Inconnu';
      const assist =
        e.assist_player_id != null
          ? (nameById.get(e.assist_player_id) ?? null)
          : null;
      const side: 'home' | 'away' =
        e.team_id != null && e.team_id === awayTeamId ? 'away' : 'home';
      return {
        minute: e.minute! + (e.extra_minute ?? 0),
        scorer,
        assist,
        detail: e.detail,
        team_side: side,
      };
    })
    .sort((a, b) => a.minute - b.minute);

  const topN = options.top_n === undefined ? 6 : options.top_n;
  return {
    home_performers: topN == null ? homePerf : homePerf.slice(0, topN),
    away_performers: topN == null ? awayPerf : awayPerf.slice(0, topN),
    goal_events: goalEvents,
  };
}
