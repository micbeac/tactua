// Mappers Football-Data.org → tables Supabase.
// Fonctions pures, typées sur l'Insert type généré par Supabase.

import type { Database } from '@/types/database';
import type {
  FdCompetition,
  FdLineupPlayer,
  FdMatch,
  FdMatchStatus,
  FdMatchTeamDetail,
  FdPerson,
  FdStandingsResponse,
  FdTeam,
} from './types';

type CompetitionInsert = Database['public']['Tables']['competitions']['Insert'];
type TeamInsert = Database['public']['Tables']['teams']['Insert'];
type PlayerInsert = Database['public']['Tables']['players']['Insert'];
type MatchInsert = Database['public']['Tables']['matches']['Insert'];
type MatchLineupInsert =
  Database['public']['Tables']['match_lineups']['Insert'];
type TeamSeasonStatsInsert =
  Database['public']['Tables']['team_season_stats']['Insert'];
type MatchStatus = MatchInsert['status'];

/** Statuts API → enum DB (matches.status). */
export function mapMatchStatus(status: FdMatchStatus): MatchStatus {
  switch (status) {
    case 'SCHEDULED':
    case 'TIMED':
      return 'scheduled';
    case 'IN_PLAY':
    case 'PAUSED':
    case 'SUSPENDED':
      return 'live';
    case 'FINISHED':
    case 'AWARDED':
      return 'finished';
    case 'POSTPONED':
      return 'postponed';
    case 'CANCELLED':
    case 'CANCELED':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}

/** Saison "YYYY" extraite de currentSeason.startDate, ou null si indispo. */
function seasonYear(c: FdCompetition): string | null {
  const start = c.currentSeason?.startDate;
  if (!start) return null;
  return start.slice(0, 4);
}

export function mapCompetition(c: FdCompetition): CompetitionInsert {
  return {
    id: c.id,
    name: c.name,
    code: c.code ?? null,
    country: c.area?.name ?? null,
    current_season: seasonYear(c),
    last_updated_at: new Date().toISOString(),
  };
}

export function mapTeam(t: FdTeam): TeamInsert {
  return {
    id: t.id,
    name: t.name,
    short_name: t.shortName ?? null,
    tla: t.tla ?? null,
    country: t.area?.name ?? null,
    logo_url: t.crest ?? null,
    founded: t.founded ?? null,
    venue: t.venue ?? null,
    last_updated_at: new Date().toISOString(),
  };
}

export function mapPlayer(p: FdPerson): PlayerInsert {
  return {
    id: p.id,
    name: p.name,
    first_name: p.firstName ?? null,
    last_name: p.lastName ?? null,
    position: p.position ?? null,
    nationality: p.nationality ?? null,
    date_of_birth: p.dateOfBirth ?? null,
    current_team_id: p.currentTeam?.id ?? null,
    last_updated_at: new Date().toISOString(),
  };
}

export function mapMatch(m: FdMatch): MatchInsert {
  return {
    id: m.id,
    competition_id: m.competition.id,
    // home/away_team_id peuvent être null pour les matchs avec équipes TBD
    // (knockouts CDM, barrages, etc.) — la migration 004 permet ces null.
    home_team_id: m.homeTeam?.id ?? null,
    away_team_id: m.awayTeam?.id ?? null,
    kickoff_at: m.utcDate,
    venue: m.venue ?? null,
    referee: m.referees?.[0]?.name ?? null,
    status: mapMatchStatus(m.status),
    score_home: m.score.fullTime.home,
    score_away: m.score.fullTime.away,
    half_time_home: m.score.halfTime.home,
    half_time_away: m.score.halfTime.away,
    matchday: m.matchday,
    stage: m.stage ?? null,
    last_updated_at: new Date().toISOString(),
  };
}

/**
 * Aplatit les lineups d'un match (XI + bench, pour chaque équipe) en lignes
 * match_lineups. `is_confirmed = true` car Football-Data ne fournit ces
 * lineups qu'à partir du moment où elles sont officielles (statut IN_PLAY
 * ou FINISHED). Pour les compos probables on aurait besoin d'une autre source.
 */
export function mapLineupsFromMatch(m: FdMatch): MatchLineupInsert[] {
  const rows: MatchLineupInsert[] = [];
  for (const [team, isHome] of [
    [m.homeTeam, true],
    [m.awayTeam, false],
  ] as Array<[FdMatchTeamDetail, boolean]>) {
    void isHome; // home/away n'est pas un champ DB ici, on stocke juste team_id
    const teamId = team.id;
    if (!teamId) continue;
    for (const p of team.lineup ?? []) {
      rows.push(buildLineupRow(m.id, teamId, p, true));
    }
    for (const p of team.bench ?? []) {
      rows.push(buildLineupRow(m.id, teamId, p, false));
    }
  }
  return rows;
}

function buildLineupRow(
  matchId: number,
  teamId: number,
  p: FdLineupPlayer,
  isStarter: boolean,
): MatchLineupInsert {
  return {
    match_id: matchId,
    team_id: teamId,
    player_id: p.id,
    position: p.position ?? null,
    shirt_number: p.shirtNumber ?? null,
    is_starter: isStarter,
    is_confirmed: true,
  };
}

/**
 * Aplatit un standings TOTAL en lignes team_season_stats.
 * Le caller passe competitionId et season car ces métadonnées
 * vivent à un niveau plus haut dans la réponse de l'API.
 */
export function mapStandingsToTeamSeasonStats(
  standings: FdStandingsResponse,
  season: string,
): TeamSeasonStatsInsert[] {
  const total = standings.standings.find((s) => s.type === 'TOTAL');
  if (!total) return [];

  return total.table.map((row) => ({
    team_id: row.team.id,
    competition_id: standings.competition.id,
    season,
    played: row.playedGames,
    wins: row.won,
    draws: row.draw,
    losses: row.lost,
    goals_for: row.goalsFor,
    goals_against: row.goalsAgainst,
    goal_difference: row.goalDifference,
    points: row.points,
    position: row.position,
    form_last_5: row.form ? row.form.split(',').map((c) => c.trim()) : null,
    last_updated_at: new Date().toISOString(),
  }));
}
