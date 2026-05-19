// Types minimaux des réponses Football-Data.org v4.
// On ne mappe que les champs réellement utilisés ; on ajoutera au fur et à
// mesure si on a besoin de plus.
// Doc : https://www.football-data.org/documentation/api

export type FdArea = {
  id: number;
  name: string;
  code?: string;
  flag?: string | null;
};

export type FdSeason = {
  id?: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  currentMatchday: number | null;
  winner?: { id: number; name: string } | null;
};

export type FdCompetition = {
  id: number;
  name: string;
  code: string;
  type?: 'LEAGUE' | 'CUP' | 'LEAGUE_CUP' | 'PLAYOFFS' | 'FRIENDLY' | string;
  area: FdArea;
  emblem?: string | null;
  currentSeason?: FdSeason;
  lastUpdated?: string;
};

export type FdTeamSummary = {
  id: number;
  name: string;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
};

export type FdTeam = FdTeamSummary & {
  area?: FdArea;
  address?: string | null;
  website?: string | null;
  founded?: number | null;
  clubColors?: string | null;
  venue?: string | null;
  coach?: { id: number; name: string } | null;
  squad?: FdPerson[];
  lastUpdated?: string;
};

export type FdPerson = {
  id: number;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null; // YYYY-MM-DD
  nationality?: string | null;
  position?: string | null;
  section?: string | null;
  shirtNumber?: number | null;
  currentTeam?: FdTeamSummary | null;
  lastUpdated?: string;
};

export type FdMatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'SUSPENDED'
  | 'FINISHED'
  | 'AWARDED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'CANCELED'; // tolérance orthographe variante US

export type FdMatchScore = {
  winner?: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  duration?: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT' | string;
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
};

export type FdReferee = {
  id: number;
  name: string;
  type?: string;
  nationality?: string | null;
};

export type FdLineupPlayer = {
  id: number;
  name: string;
  position?: string | null;
  shirtNumber?: number | null;
};

export type FdMatchTeamDetail = FdTeamSummary & {
  formation?: string | null;
  coach?: { id?: number; name: string } | null;
  lineup?: FdLineupPlayer[];
  bench?: FdLineupPlayer[];
};

export type FdMatch = {
  id: number;
  competition: { id: number; name: string; code?: string };
  utcDate: string; // ISO 8601 UTC
  status: FdMatchStatus;
  matchday: number | null;
  stage?: string | null;
  group?: string | null;
  homeTeam: FdMatchTeamDetail;
  awayTeam: FdMatchTeamDetail;
  score: FdMatchScore;
  referees?: FdReferee[];
  venue?: string | null;
  lastUpdated?: string;
};

// Wrappers de réponses (les endpoints retournent souvent un objet conteneur).
export type FdTeamsResponse = { count: number; teams: FdTeam[] };

// Le top-level `count` existe sur certains endpoints (/teams?, /matches?),
// mais /competitions/{id}/matches met le count dans `resultSet.count`.
export type FdMatchesResponse = {
  count?: number;
  resultSet?: { count: number; first?: string; last?: string; played?: number };
  matches: FdMatch[];
};
export type FdStandingsResponse = {
  competition: { id: number; name: string };
  season: FdSeason;
  standings: Array<{
    stage: string;
    type: 'TOTAL' | 'HOME' | 'AWAY';
    group?: string | null;
    table: Array<{
      position: number;
      team: FdTeamSummary;
      playedGames: number;
      form?: string | null;
      won: number;
      draw: number;
      lost: number;
      points: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDifference: number;
    }>;
  }>;
};
