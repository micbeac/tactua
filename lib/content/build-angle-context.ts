// Construit le contexte complet d'un match (pré ou post) à injecter dans
// les prompts de génération d'angles vidéo TikTok.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getStandingContext,
  getTeamGoalTiming,
  getTeamSeasonXG,
} from '@/lib/data/match-context';
import { getHeadToHead, getTeamForm } from '@/lib/data/match';
import type {
  AngleMatchContext,
  TeamContext,
} from '@/lib/openai/content-angles';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

// Mapping competition_id → code court pour le champ `championnat`.
const COMPETITION_CODE: Record<number, string> = {
  2000: 'CDM',
  2001: 'CL',
  2002: 'Bundesliga',
  2014: 'Liga',
  2015: 'L1',
  2019: 'SerieA',
  2021: 'PL',
  9001: 'JPL',
};

type MatchRow = {
  id: number;
  competition_id: number;
  kickoff_at: string;
  status: string;
  half_time_home: number | null;
  half_time_away: number | null;
  score_home: number | null;
  score_away: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  competition: { name: string; current_season: string | null } | null;
  home_team: { id: number; name: string } | null;
  away_team: { id: number; name: string } | null;
};

const MATCH_SELECT = `
  id, competition_id, kickoff_at, status,
  half_time_home, half_time_away, score_home, score_away,
  home_team_id, away_team_id,
  competition:competitions(name, current_season),
  home_team:teams!matches_home_team_id_fkey(id, name),
  away_team:teams!matches_away_team_id_fkey(id, name)
`;

async function getTopScorers(
  supabase: Supa,
  teamId: number,
): Promise<Array<{ name: string; goals: number; assists: number }>> {
  // player_season_stats agrège toutes saisons. On filtre les joueurs ayant
  // teamId comme current_team_id et on classe par buts DESC.
  const { data: players } = await supabase
    .from('players')
    .select('id, name')
    .eq('current_team_id', teamId)
    .limit(50);

  const ids = ((players ?? []) as Array<{ id: number; name: string }>).map(
    (p) => p.id,
  );
  if (ids.length === 0) return [];

  const { data: stats } = await supabase
    .from('player_season_stats')
    .select('player_id, goals, assists')
    .in('player_id', ids);

  const totals = new Map<number, { goals: number; assists: number }>();
  for (const s of (stats ?? []) as Array<{
    player_id: number;
    goals: number | null;
    assists: number | null;
  }>) {
    const cur = totals.get(s.player_id) ?? { goals: 0, assists: 0 };
    cur.goals += s.goals ?? 0;
    cur.assists += s.assists ?? 0;
    totals.set(s.player_id, cur);
  }

  return ((players ?? []) as Array<{ id: number; name: string }>)
    .map((p) => {
      const t = totals.get(p.id) ?? { goals: 0, assists: 0 };
      return { name: p.name, goals: t.goals, assists: t.assists };
    })
    .filter((p) => p.goals > 0 || p.assists > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
    .slice(0, 3);
}

async function buildTeamContext(
  supabase: Supa,
  team: { id: number; name: string },
  competitionId: number,
  competitionSeason: string | null,
  matchId: number,
): Promise<TeamContext> {
  const [form, standing, xg, timing, topScorers] = await Promise.all([
    getTeamForm(supabase, team.id, matchId, 5),
    competitionSeason
      ? getStandingContext(supabase, competitionId, competitionSeason, team.id)
      : Promise.resolve(null),
    getTeamSeasonXG(supabase, team.id, competitionId),
    getTeamGoalTiming(supabase, team.id, competitionId),
    getTopScorers(supabase, team.id),
  ]);

  // getTeamForm renvoie un tableau d'objets {result:'W'|'D'|'L'} (selon impl
  // existante). On normalise vers la lettre.
  type FormItem = { result?: 'W' | 'D' | 'L' } | 'W' | 'D' | 'L';
  const formLetters =
    Array.isArray(form) && form.length > 0
      ? (form as FormItem[])
          .map((f) =>
            typeof f === 'string'
              ? f
              : (f as { result?: 'W' | 'D' | 'L' }).result,
          )
          .filter((r): r is 'W' | 'D' | 'L' => r === 'W' || r === 'D' || r === 'L')
      : null;

  return {
    id: team.id,
    name: team.name,
    form_last_5: formLetters && formLetters.length > 0 ? formLetters : null,
    position: standing?.position ?? null,
    total_teams: standing?.total_teams ?? null,
    points: standing?.points ?? null,
    xg_for_avg: xg?.xg_for_avg ?? null,
    xg_against_avg: xg?.xg_against_avg ?? null,
    scored_early_pct: timing?.scored_early_pct ?? null,
    scored_late_pct: timing?.scored_late_pct ?? null,
    conceded_early_pct: timing?.conceded_early_pct ?? null,
    conceded_late_pct: timing?.conceded_late_pct ?? null,
    top_scorers: topScorers,
  };
}

async function buildPostMatchOutcome(
  supabase: Supa,
  matchId: number,
  homeName: string,
  awayName: string,
  homeId: number | null,
  awayId: number | null,
  scoreHome: number | null,
  scoreAway: number | null,
  htHome: number | null,
  htAway: number | null,
): Promise<NonNullable<AngleMatchContext['match_outcome']>> {
  const [eventsRes, teamStatsRes, playerStatsRes] = await Promise.all([
    supabase
      .from('match_events')
      .select(
        `minute, type, detail, team_id, player_id,
         team:teams!match_events_team_id_fkey(name),
         player:players!match_events_player_id_fkey(name)`,
      )
      .eq('match_id', matchId)
      .not('minute', 'is', null)
      .order('minute', { ascending: true })
      .limit(40),
    supabase
      .from('match_team_stats')
      .select(
        'team_id, possession, shots, shots_on_target, corners, expected_goals',
      )
      .eq('match_id', matchId),
    supabase
      .from('match_player_stats')
      .select(
        `player_id, rating, goals, assists, shots, key_passes,
         player:players!match_player_stats_player_id_fkey(name, current_team_id)`,
      )
      .eq('match_id', matchId)
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(10),
  ]);

  type EventRow = {
    minute: number | null;
    type: string;
    detail: string | null;
    team_id: number | null;
    player_id: number | null;
    team: { name: string } | null;
    player: { name: string } | null;
  };
  type TeamStatRow = {
    team_id: number;
    possession: number | null;
    shots: number | null;
    shots_on_target: number | null;
    corners: number | null;
    expected_goals: number | null;
  };
  type PlayerStatRow = {
    player_id: number;
    rating: number | null;
    goals: number | null;
    assists: number | null;
    shots: number | null;
    key_passes: number | null;
    player: { name: string; current_team_id: number | null } | null;
  };

  const events = ((eventsRes.data ?? []) as unknown as EventRow[]).map((e) => ({
    minute: e.minute,
    type: e.type,
    detail: e.detail,
    team_name: e.team?.name ?? null,
    player_name: e.player?.name ?? null,
  }));

  const nameForTeamId = (id: number | null) =>
    id == null ? '' : id === homeId ? homeName : id === awayId ? awayName : '';

  const teamStats = (teamStatsRes.data ?? []) as TeamStatRow[];
  const teamStatsMapped = teamStats.map((s) => ({
    team_name: nameForTeamId(s.team_id),
    possession: s.possession,
    shots: s.shots,
    shots_on_target: s.shots_on_target,
    corners: s.corners,
    xg: s.expected_goals,
  }));

  const playerStats = ((playerStatsRes.data ?? []) as unknown as PlayerStatRow[])
    .filter((p) => p.player)
    .map((p) => ({
      player_name: p.player!.name,
      team_name: nameForTeamId(p.player!.current_team_id),
      rating: p.rating,
      goals: p.goals,
      assists: p.assists,
      shots: p.shots,
      key_passes: p.key_passes,
    }));

  return {
    score_home: scoreHome,
    score_away: scoreAway,
    half_time_home: htHome,
    half_time_away: htAway,
    events,
    team_stats: teamStatsMapped,
    top_player_stats: playerStats,
  };
}

async function buildPreMatchInputs(
  supabase: Supa,
  homeId: number,
  awayId: number,
  matchId: number,
): Promise<NonNullable<AngleMatchContext['pre_match_inputs']>> {
  const h2hRaw = await getHeadToHead(supabase, homeId, awayId, matchId, 5);
  type H2HItem = {
    kickoff_at: string;
    home_team?: { name: string } | null;
    away_team?: { name: string } | null;
    score_home: number | null;
    score_away: number | null;
  };
  const h2h = (h2hRaw as unknown as H2HItem[]).map((m) => ({
    kickoff_iso: m.kickoff_at,
    home_team: m.home_team?.name ?? '?',
    away_team: m.away_team?.name ?? '?',
    score_home: m.score_home,
    score_away: m.score_away,
  }));
  return { h2h };
}

/**
 * Construit le contexte complet d'un match pour l'injection dans le prompt.
 * `phase` détermine si on collecte les inputs pré ou post match.
 */
export async function buildAngleContext(
  supabase: Supa,
  matchId: number,
  phase: 'pre_match' | 'post_match',
): Promise<AngleMatchContext | null> {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('id', matchId)
    .maybeSingle();
  if (error || !data) return null;
  const m = data as unknown as MatchRow;
  if (!m.home_team || !m.away_team) return null;

  const competitionName = m.competition?.name ?? 'Football';
  const championnat = COMPETITION_CODE[m.competition_id] ?? competitionName;

  const [home, away] = await Promise.all([
    buildTeamContext(
      supabase,
      m.home_team,
      m.competition_id,
      m.competition?.current_season ?? null,
      m.id,
    ),
    buildTeamContext(
      supabase,
      m.away_team,
      m.competition_id,
      m.competition?.current_season ?? null,
      m.id,
    ),
  ]);

  const ctx: AngleMatchContext = {
    phase,
    match_id: m.id,
    kickoff_iso: m.kickoff_at,
    competition_name: competitionName,
    championnat_code: championnat,
    home,
    away,
  };

  if (phase === 'post_match') {
    ctx.match_outcome = await buildPostMatchOutcome(
      supabase,
      m.id,
      m.home_team.name,
      m.away_team.name,
      m.home_team_id,
      m.away_team_id,
      m.score_home,
      m.score_away,
      m.half_time_home,
      m.half_time_away,
    );
  } else if (m.home_team_id != null && m.away_team_id != null) {
    ctx.pre_match_inputs = await buildPreMatchInputs(
      supabase,
      m.home_team_id,
      m.away_team_id,
      m.id,
    );
  }

  return ctx;
}
