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
  photo_url: string | null;
  shirt_number: number | null;
  /** Stats en sélection (agrégat 2 dernières années) — null pour un club */
  intl_caps: number | null;
  intl_goals: number | null;
  intl_assists: number | null;
};

export async function getTeamSquad(
  supabase: Supa,
  teamId: number,
): Promise<SquadPlayer[]> {
  // Source 1 : players.current_team_id = teamId (cas des clubs)
  const clubReq = supabase
    .from('players')
    .select(
      'id, name, position, date_of_birth, nationality, photo_url, shirt_number',
    )
    .eq('current_team_id', teamId);

  // Source 2 : national_team_squads (cas des sélections — current_team_id
  // des joueurs pointe sur leur club, pas sur la sélection)
  const natReq = supabase
    .from('national_team_squads')
    .select(
      `position, shirt_number, intl_caps, intl_goals, intl_assists,
       player:players(id, name, date_of_birth, nationality, photo_url)`,
    )
    .eq('team_id', teamId);

  const [clubRes, natRes] = await Promise.all([clubReq, natReq]);

  if (clubRes.error) console.error('[data/team] squad (club)', clubRes.error);
  if (natRes.error) console.error('[data/team] squad (national)', natRes.error);

  const byId = new Map<number, SquadPlayer>();

  for (const p of (clubRes.data ?? []) as Array<Omit<
    SquadPlayer,
    'intl_caps' | 'intl_goals' | 'intl_assists'
  >>) {
    byId.set(p.id, {
      ...p,
      intl_caps: null,
      intl_goals: null,
      intl_assists: null,
    });
  }

  type NatRow = {
    position: string | null;
    shirt_number: number | null;
    intl_caps: number;
    intl_goals: number;
    intl_assists: number;
    player: {
      id: number;
      name: string;
      date_of_birth: string | null;
      nationality: string | null;
      photo_url: string | null;
    } | null;
  };

  for (const r of (natRes.data ?? []) as unknown as NatRow[]) {
    if (!r.player) continue;
    const existing = byId.get(r.player.id);
    if (existing) {
      // Préfère le n° de maillot fourni par la sélection si dispo
      if (existing.shirt_number == null && r.shirt_number != null) {
        existing.shirt_number = r.shirt_number;
      }
      // Complète les stats sélection (cas équipe nationale)
      existing.intl_caps = r.intl_caps;
      existing.intl_goals = r.intl_goals;
      existing.intl_assists = r.intl_assists;
      continue;
    }
    byId.set(r.player.id, {
      id: r.player.id,
      name: r.player.name,
      position: r.position,
      date_of_birth: r.player.date_of_birth,
      nationality: r.player.nationality,
      photo_url: r.player.photo_url,
      shirt_number: r.shirt_number,
      intl_caps: r.intl_caps,
      intl_goals: r.intl_goals,
      intl_assists: r.intl_assists,
    });
  }

  const all = Array.from(byId.values());
  all.sort((a, b) => {
    if (a.shirt_number != null && b.shirt_number != null) {
      if (a.shirt_number !== b.shirt_number) {
        return a.shirt_number - b.shirt_number;
      }
    } else if (a.shirt_number != null) return -1;
    else if (b.shirt_number != null) return 1;
    return a.name.localeCompare(b.name);
  });
  return all;
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
