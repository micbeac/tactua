// Helpers pour récupérer des statistiques détaillées sur une équipe et un
// affrontement direct via API-Football (plan Pro requis pour la saison en cours).

const BASE_URL = 'https://v3.football.api-sports.io';

function apiKey(): string {
  const k = process.env.API_FOOTBALL_KEY;
  if (!k) throw new Error('API_FOOTBALL_KEY manquant');
  return k;
}

async function af<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': apiKey(), Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `API-Football ${res.status} on ${path}: ${body.slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}

// ============================================================================
// Team statistics — /teams/statistics
// ============================================================================

export type TeamStatsResponse = {
  response: {
    league: { id: number; name: string; country: string; season: number };
    team: { id: number; name: string };
    form: string; // "WLDWWWLD..." sur toute la saison
    fixtures: {
      played: { home: number; away: number; total: number };
      wins: { home: number; away: number; total: number };
      draws: { home: number; away: number; total: number };
      loses: { home: number; away: number; total: number };
    };
    goals: {
      for: {
        total: { home: number; away: number; total: number };
        average: { home: string; away: string; total: string };
      };
      against: {
        total: { home: number; away: number; total: number };
        average: { home: string; away: string; total: string };
      };
    };
    biggest: {
      streak: { wins: number; draws: number; loses: number };
      wins: { home: string | null; away: string | null };
      loses: { home: string | null; away: string | null };
      goals: {
        for: { home: number; away: number };
        against: { home: number; away: number };
      };
    };
    clean_sheet: { home: number; away: number; total: number };
    failed_to_score: { home: number; away: number; total: number };
    lineups: Array<{ formation: string; played: number }>;
  };
};

export async function fetchTeamStats(
  teamId: number,
  leagueId: number,
  season: number,
): Promise<TeamStatsResponse['response']> {
  const d = await af<TeamStatsResponse>(
    `/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`,
  );
  return d.response;
}

// ============================================================================
// Active injuries — /injuries (filtré aux derniers 14 jours)
// ============================================================================

export type InjuryResponse = {
  response: Array<{
    player: {
      id: number;
      name: string;
      photo: string | null;
      type: string;
      reason: string | null;
    };
    team: { id: number; name: string };
    fixture: { id: number; date: string };
    league: { id: number };
  }>;
};

export type ActiveInjury = {
  player_name: string;
  reason: string | null;
  last_seen: string; // YYYY-MM-DD
};

/**
 * Renvoie les blessures/suspensions actives autour du `referenceDate`.
 * On filtre aux indispos remontées dans la fenêtre [refDate - 14j, refDate + 7j].
 * On déduplique par joueur (garde l'entrée la plus récente).
 */
export async function fetchActiveInjuries(
  teamId: number,
  season: number,
  referenceDate: Date,
): Promise<ActiveInjury[]> {
  const d = await af<InjuryResponse>(
    `/injuries?team=${teamId}&season=${season}`,
  );
  const refMs = referenceDate.getTime();
  const windowBefore = 14 * 24 * 60 * 60 * 1000;
  const windowAfter = 7 * 24 * 60 * 60 * 1000;

  const map = new Map<string, ActiveInjury>();
  for (const inj of d.response) {
    const fixtureMs = new Date(inj.fixture.date).getTime();
    if (fixtureMs < refMs - windowBefore || fixtureMs > refMs + windowAfter) {
      continue;
    }
    const key = inj.player.name;
    const existing = map.get(key);
    const date = inj.fixture.date.slice(0, 10);
    if (!existing || date > existing.last_seen) {
      map.set(key, {
        player_name: inj.player.name,
        reason: inj.player.reason,
        last_seen: date,
      });
    }
  }
  return Array.from(map.values()).slice(0, 10);
}

// ============================================================================
// H2H — /fixtures/headtohead
// ============================================================================

export type H2HResponse = {
  response: Array<{
    fixture: { id: number; date: string };
    league: { id: number; name: string };
    teams: {
      home: { id: number; name: string; winner: boolean | null };
      away: { id: number; name: string; winner: boolean | null };
    };
    goals: { home: number | null; away: number | null };
  }>;
};

export type H2HMatch = {
  date: string;
  league: string;
  home_team: string;
  away_team: string;
  score_home: number | null;
  score_away: number | null;
};

export async function fetchH2H(
  teamA: number,
  teamB: number,
  last = 10,
): Promise<H2HMatch[]> {
  const d = await af<H2HResponse>(
    `/fixtures/headtohead?h2h=${teamA}-${teamB}&last=${last}`,
  );
  return d.response.map((f) => ({
    date: f.fixture.date.slice(0, 10),
    league: f.league.name,
    home_team: f.teams.home.name,
    away_team: f.teams.away.name,
    score_home: f.goals.home,
    score_away: f.goals.away,
  }));
}

// ============================================================================
// Squad complet — /players/squads (photos + numéros)
// ============================================================================

type SquadResponse = {
  response: Array<{
    team: { id: number; name: string };
    players: Array<{
      id: number;
      name: string;
      age: number | null;
      number: number | null;
      position: string | null;
      photo: string | null;
    }>;
  }>;
};

export type SquadEntry = {
  player_id: number;
  name: string;
  age: number | null;
  number: number | null;
  position: string | null;
  photo: string | null;
};

export async function fetchSquad(teamId: number): Promise<SquadEntry[]> {
  const d = await af<SquadResponse>(`/players/squads?team=${teamId}`);
  const team = d.response[0];
  if (!team) return [];
  return team.players.map((p) => ({
    player_id: p.id,
    name: p.name,
    age: p.age,
    number: p.number,
    position: p.position,
    photo: p.photo,
  }));
}

// ============================================================================
// Top players — /players?team=X&season=Y (paginé)
// ============================================================================

type PlayerSeasonResponse = {
  response: Array<{
    player: { id: number; name: string; photo: string | null };
    statistics: Array<{
      league: { id: number };
      games: {
        appearences: number | null;
        lineups: number | null;
        minutes: number | null;
        position: string | null;
        rating: string | null;
        captain: boolean | null;
      };
      shots: { total: number | null; on: number | null };
      goals: {
        total: number | null;
        assists: number | null;
        conceded: number | null;
        saves: number | null;
      };
      passes: {
        total: number | null;
        key: number | null;
        accuracy: number | string | null;
      };
      dribbles: {
        attempts: number | null;
        success: number | null;
      };
      tackles: {
        total: number | null;
        interceptions: number | null;
      };
      duels: { total: number | null; won: number | null };
      cards: { yellow: number | null; red: number | null };
    }>;
  }>;
  paging: { current: number; total: number };
};

export type SquadPerformer = {
  player_id: number;
  player_name: string;
  photo: string | null;
  position: string | null;
  is_captain: boolean;
  appearances: number;
  lineups: number;
  minutes: number;
  goals: number;
  assists: number;
  rating: number | null;
  shots_on_target: number | null;
  key_passes: number | null;
  passes_accuracy: number | null;
  dribbles_success_ratio: number | null;
  duels_won_ratio: number | null;
  yellow_cards: number;
  red_cards: number;
  // Spécifique gardien (null sinon)
  saves: number | null;
  goals_conceded: number | null;
};

function ratio(num: number | null, denom: number | null): number | null {
  if (num == null || denom == null || denom === 0) return null;
  return Math.round((num / denom) * 100) / 100;
}

function asNumber(v: number | string | null): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const n = Number(v.replace?.('%', '') ?? v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Top performers d'une équipe sur la saison en cours dans une compétition.
 * On récupère toutes les pages, on filtre sur la league cible, on trie par
 * (goals + assists) desc, on garde les 7 premiers.
 */
export async function fetchTopPerformers(
  teamId: number,
  leagueId: number,
  season: number,
  topN = 7,
): Promise<SquadPerformer[]> {
  const performers: SquadPerformer[] = [];
  let page = 1;
  let totalPages = 1;

  // Limite de sécurité : 5 pages max (= 100 joueurs, largement plus qu'un squad)
  while (page <= totalPages && page <= 5) {
    const d = await af<PlayerSeasonResponse>(
      `/players?team=${teamId}&season=${season}&page=${page}`,
    );
    totalPages = d.paging.total;

    for (const p of d.response) {
      const s = p.statistics.find((st) => st.league.id === leagueId);
      if (!s || !s.games.appearences || s.games.appearences === 0) continue;
      const rating = s.games.rating ? Number(s.games.rating) : null;
      performers.push({
        player_id: p.player.id,
        player_name: p.player.name,
        photo: p.player.photo,
        position: s.games.position,
        is_captain: Boolean(s.games.captain),
        appearances: s.games.appearences,
        lineups: s.games.lineups ?? 0,
        minutes: s.games.minutes ?? 0,
        goals: s.goals.total ?? 0,
        assists: s.goals.assists ?? 0,
        rating: Number.isFinite(rating ?? NaN) ? rating : null,
        shots_on_target: s.shots.on,
        key_passes: s.passes.key,
        passes_accuracy: asNumber(s.passes.accuracy),
        dribbles_success_ratio: ratio(s.dribbles.success, s.dribbles.attempts),
        duels_won_ratio: ratio(s.duels.won, s.duels.total),
        yellow_cards: s.cards.yellow ?? 0,
        red_cards: s.cards.red ?? 0,
        saves: s.goals.saves,
        goals_conceded: s.goals.conceded,
      });
    }
    page += 1;
  }

  performers.sort((a, b) => {
    const sA = a.goals + a.assists;
    const sB = b.goals + b.assists;
    if (sB !== sA) return sB - sA;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });

  return performers.slice(0, topN);
}
