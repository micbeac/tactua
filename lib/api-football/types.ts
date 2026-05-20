// Types minimaux des réponses API-Football v3 (api-football.com).
// Doc : https://www.api-football.com/documentation-v3

export type AFFixtureSearch = {
  response: Array<{
    fixture: {
      id: number;
      date: string; // ISO
      timestamp: number;
      venue: { id: number | null; name: string | null; city: string | null };
      status: { long: string; short: string; elapsed: number | null };
    };
    league: {
      id: number;
      name: string;
      country: string;
      season: number;
    };
    teams: {
      home: { id: number; name: string; logo: string };
      away: { id: number; name: string; logo: string };
    };
    goals: { home: number | null; away: number | null };
    score: {
      halftime: { home: number | null; away: number | null };
      fulltime: { home: number | null; away: number | null };
    };
  }>;
};

export type AFLineupPlayer = {
  player: {
    id: number;
    name: string;
    number: number | null;
    pos: string | null; // G/D/M/F
    grid: string | null; // ex "4:2" pour la position sur le terrain
  };
};

export type AFLineupsResponse = {
  response: Array<{
    team: { id: number; name: string; logo: string };
    formation: string | null;
    startXI: AFLineupPlayer[];
    substitutes: AFLineupPlayer[];
    coach: { id: number | null; name: string; photo: string | null };
  }>;
};

export type AFStatItem = { type: string; value: number | string | null };

export type AFTeamStatsResponse = {
  response: Array<{
    team: { id: number; name: string; logo: string };
    statistics: AFStatItem[];
  }>;
};

export type AFPlayerStatLine = {
  player: { id: number; name: string };
  statistics: Array<{
    games: {
      minutes: number | null;
      number: number | null;
      position: string | null;
      rating: string | null; // numerique en string ex "7.5"
      substitute: boolean | null;
    };
    shots: { total: number | null; on: number | null };
    goals: {
      total: number | null;
      conceded: number | null;
      assists: number | null;
      saves: number | null;
    };
    passes: {
      total: number | null;
      key: number | null;
      accuracy: string | null;
    };
    cards: { yellow: number | null; red: number | null };
  }>;
};

export type AFPlayerStatsResponse = {
  response: Array<{
    team: { id: number; name: string; logo: string };
    players: AFPlayerStatLine[];
  }>;
};
