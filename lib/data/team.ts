import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type TeamRow = {
  id: number;
  name: string;
  short_name: string | null;
  tla: string | null;
  country: string | null;
  logo_url: string | null;
  founded: number | null;
  venue: string | null;
};

export async function getTeam(
  supabase: Supa,
  id: number,
): Promise<TeamRow | null> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, short_name, tla, country, logo_url, founded, venue')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[data/team] getTeam', error);
    return null;
  }
  return (data as TeamRow | null) ?? null;
}

export type TeamSeasonStatsRow = {
  competition_id: number;
  season: string;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goals_for: number | null;
  goals_against: number | null;
  goal_difference: number | null;
  points: number | null;
  position: number | null;
  form_last_5: string[] | null;
  competition: { id: number; name: string; country: string | null } | null;
};

/**
 * Stats saison principales d'une équipe sur ses compétitions actives.
 * On garde toutes les lignes (1 par compétition), ordonnées par points DESC
 * puis position ASC — la "principale" est la première.
 */
export async function getTeamSeasonStats(
  supabase: Supa,
  teamId: number,
): Promise<TeamSeasonStatsRow[]> {
  const { data, error } = await supabase
    .from('team_season_stats')
    .select(
      `competition_id, season, played, wins, draws, losses, goals_for, goals_against,
       goal_difference, points, position, form_last_5,
       competition:competitions(id, name, country)`,
    )
    .eq('team_id', teamId)
    .order('points', { ascending: false })
    .order('position', { ascending: true });
  if (error) {
    console.error('[data/team] getTeamSeasonStats', error);
    return [];
  }
  return (data ?? []) as unknown as TeamSeasonStatsRow[];
}

export type ScheduleMatch = {
  id: number;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  score_home: number | null;
  score_away: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  competition: { id: number; name: string } | null;
  opponent: {
    id: number;
    name: string;
    tla: string | null;
    logo_url: string | null;
  } | null;
};

type RawScheduleMatch = {
  id: number;
  kickoff_at: string;
  status: ScheduleMatch['status'];
  score_home: number | null;
  score_away: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  competition: { id: number; name: string } | null;
  home_team: {
    id: number;
    name: string;
    tla: string | null;
    logo_url: string | null;
  } | null;
  away_team: {
    id: number;
    name: string;
    tla: string | null;
    logo_url: string | null;
  } | null;
};

const SCHEDULE_SELECT = `
  id, kickoff_at, status, score_home, score_away, home_team_id, away_team_id,
  competition:competitions(id, name),
  home_team:teams!matches_home_team_id_fkey(id, name, tla, logo_url),
  away_team:teams!matches_away_team_id_fkey(id, name, tla, logo_url)
`;

function withOpponent(teamId: number, m: RawScheduleMatch): ScheduleMatch {
  const opponent = m.home_team_id === teamId ? m.away_team : m.home_team;
  return {
    id: m.id,
    kickoff_at: m.kickoff_at,
    status: m.status,
    score_home: m.score_home,
    score_away: m.score_away,
    home_team_id: m.home_team_id,
    away_team_id: m.away_team_id,
    competition: m.competition,
    opponent: opponent ?? null,
  };
}

export async function getTeamUpcomingMatches(
  supabase: Supa,
  teamId: number,
  limit = 5,
): Promise<ScheduleMatch[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(SCHEDULE_SELECT)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .in('status', ['scheduled', 'live'])
    .gte('kickoff_at', new Date().toISOString())
    .order('kickoff_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('[data/team] upcoming', error);
    return [];
  }
  return (data ?? []).map((m) =>
    withOpponent(teamId, m as unknown as RawScheduleMatch),
  );
}

export async function getTeamRecentMatches(
  supabase: Supa,
  teamId: number,
  limit = 5,
): Promise<ScheduleMatch[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(SCHEDULE_SELECT)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq('status', 'finished')
    .order('kickoff_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[data/team] recent', error);
    return [];
  }
  return (data ?? []).map((m) =>
    withOpponent(teamId, m as unknown as RawScheduleMatch),
  );
}

export type StandingsRow = {
  team_id: number;
  position: number | null;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goals_for: number | null;
  goals_against: number | null;
  goal_difference: number | null;
  points: number | null;
  team: {
    id: number;
    name: string;
    tla: string | null;
    logo_url: string | null;
  } | null;
};

export type SquadPlayer = {
  id: number;
  name: string;
  position: string | null;
  date_of_birth: string | null;
  nationality: string | null;
};

export async function getTeamSquad(
  supabase: Supa,
  teamId: number,
): Promise<SquadPlayer[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, name, position, date_of_birth, nationality')
    .eq('current_team_id', teamId)
    .order('name');
  if (error) {
    console.error('[data/team] squad', error);
    return [];
  }
  return (data ?? []) as SquadPlayer[];
}

/**
 * Classement d'une compétition/saison, ordonné par position.
 * Renvoie tout le tableau ; l'appelant décide de tronquer.
 */
export async function getCompetitionStandings(
  supabase: Supa,
  competitionId: number,
  season: string,
): Promise<StandingsRow[]> {
  const { data, error } = await supabase
    .from('team_season_stats')
    .select(
      `team_id, position, played, wins, draws, losses, goals_for, goals_against,
       goal_difference, points,
       team:teams(id, name, tla, logo_url)`,
    )
    .eq('competition_id', competitionId)
    .eq('season', season)
    .order('position', { ascending: true });
  if (error) {
    console.error('[data/team] standings', error);
    return [];
  }
  return (data ?? []) as unknown as StandingsRow[];
}
