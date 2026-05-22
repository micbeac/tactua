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
        minute?: Record<
          string,
          { total: number | null; percentage: string | null }
        >;
      };
      against: {
        total: { home: number; away: number; total: number };
        average: { home: string; away: string; total: string };
        minute?: Record<
          string,
          { total: number | null; percentage: string | null }
        >;
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
  /** 'suspension' (cumul cartons / rouge), 'injury' (blessure) ou 'other' */
  kind: 'suspension' | 'injury' | 'other';
  last_seen: string; // YYYY-MM-DD
};

/** Déduit le type d'indisponibilité à partir du libellé `reason`. */
function classifyInjuryReason(
  reason: string | null,
): 'suspension' | 'injury' | 'other' {
  if (!reason) return 'other';
  const r = reason.toLowerCase();
  if (
    r.includes('suspend') ||
    r.includes('red card') ||
    r.includes('carton') ||
    r.includes('cards')
  ) {
    return 'suspension';
  }
  return 'injury';
}

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
        kind: classifyInjuryReason(inj.player.reason),
        last_seen: date,
      });
    }
  }
  return Array.from(map.values()).slice(0, 10);
}

// ============================================================================
// Odds — /odds?fixture=X
// ============================================================================
// Les cotes ne sont JAMAIS affichées : on les agrège en probabilités
// implicites de consensus (marge bookmaker retirée) pour enrichir, en
// interne, le calibrage des analyses IA. Pas une feature de paris.

type OddsResponse = {
  response: Array<{
    bookmakers: Array<{
      id: number;
      name: string;
      bets: Array<{
        id: number;
        name: string;
        values: Array<{ value: string; odd: string }>;
      }>;
    }>;
  }>;
};

export type MarketConsensus = {
  /** Nombre de sources de données agrégées */
  source_count: number;
  /** Probas victoire dom / nul / victoire ext (somme = 100) */
  match_winner: {
    home_pct: number;
    draw_pct: number;
    away_pct: number;
  } | null;
  /** Proba que les 2 équipes marquent */
  btts_yes_pct: number | null;
  /** Proba plus de 2,5 buts dans le match */
  over_2_5_pct: number | null;
};

/**
 * Cote décimale → probabilités normalisées (retire la marge bookmaker :
 * la somme des 1/cote vaut > 1, on ramène à 1).
 */
function impliedProbs(odds: number[]): number[] {
  const raw = odds.map((o) => (o > 0 ? 1 / o : 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return odds.map(() => 0);
  return raw.map((r) => r / sum);
}

function average(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Récupère les cotes d'un match et les agrège en probabilités implicites
 * de consensus, moyennées sur tous les bookmakers disponibles.
 * Renvoie null si aucune cote (match trop lointain, hors fenêtre 1-14j).
 */
export async function fetchMatchOdds(
  fixtureId: number,
): Promise<MarketConsensus | null> {
  const d = await af<OddsResponse>(`/odds?fixture=${fixtureId}`);
  const bookmakers = d.response[0]?.bookmakers ?? [];
  if (bookmakers.length === 0) return null;

  const mwHome: number[] = [];
  const mwDraw: number[] = [];
  const mwAway: number[] = [];
  const bttsYes: number[] = [];
  const over25: number[] = [];

  for (const bk of bookmakers) {
    for (const bet of bk.bets) {
      if (bet.id === 1) {
        // Match Winner (1N2)
        const h = bet.values.find((v) => v.value === 'Home');
        const dr = bet.values.find((v) => v.value === 'Draw');
        const a = bet.values.find((v) => v.value === 'Away');
        if (h && dr && a) {
          const [ph, pd, pa] = impliedProbs([
            Number(h.odd),
            Number(dr.odd),
            Number(a.odd),
          ]);
          mwHome.push(ph);
          mwDraw.push(pd);
          mwAway.push(pa);
        }
      } else if (bet.id === 8) {
        // Both Teams Score
        const y = bet.values.find((v) => v.value === 'Yes');
        const n = bet.values.find((v) => v.value === 'No');
        if (y && n) {
          const [py] = impliedProbs([Number(y.odd), Number(n.odd)]);
          bttsYes.push(py);
        }
      } else if (bet.id === 5) {
        // Goals Over/Under — ligne 2.5
        const o = bet.values.find((v) => v.value === 'Over 2.5');
        const u = bet.values.find((v) => v.value === 'Under 2.5');
        if (o && u) {
          const [po] = impliedProbs([Number(o.odd), Number(u.odd)]);
          over25.push(po);
        }
      }
    }
  }

  const pct = (x: number | null): number | null =>
    x == null ? null : Math.round(x * 100);

  const h = average(mwHome);
  const dr = average(mwDraw);
  const a = average(mwAway);

  return {
    source_count: bookmakers.length,
    match_winner:
      h != null && dr != null && a != null
        ? { home_pct: pct(h)!, draw_pct: pct(dr)!, away_pct: pct(a)! }
        : null,
    btts_yes_pct: pct(average(bttsYes)),
    over_2_5_pct: pct(average(over25)),
  };
}

// ============================================================================
// Prediction native API-Football — /predictions?fixture=X
// ============================================================================
// Modèle statistique propre à AF. On en extrait le bloc `comparison` :
// une comparaison domicile/extérieur (en %) sur plusieurs dimensions.
// Signal de calibrage interne, indépendant du consensus des cotes.

type PredictionResponse = {
  response: Array<{
    comparison?: {
      form?: { home: string; away: string };
      att?: { home: string; away: string };
      def?: { home: string; away: string };
      poisson_distribution?: { home: string; away: string };
      h2h?: { home: string; away: string };
      goals?: { home: string; away: string };
      total?: { home: string; away: string };
    };
  }>;
};

export type AFPrediction = {
  /** Chaque dimension : poids domicile vs extérieur (somme ≈ 100) */
  form: { home: number; away: number };
  attack: { home: number; away: number };
  defense: { home: number; away: number };
  poisson: { home: number; away: number };
  /** Projection globale du modèle AF */
  overall: { home: number; away: number };
};

function parsePct(s: string | null | undefined): number {
  if (!s) return 0;
  const n = Number(s.replace('%', '').trim());
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export async function fetchMatchPrediction(
  fixtureId: number,
): Promise<AFPrediction | null> {
  const d = await af<PredictionResponse>(
    `/predictions?fixture=${fixtureId}`,
  );
  const c = d.response[0]?.comparison;
  if (!c) return null;
  return {
    form: { home: parsePct(c.form?.home), away: parsePct(c.form?.away) },
    attack: { home: parsePct(c.att?.home), away: parsePct(c.att?.away) },
    defense: { home: parsePct(c.def?.home), away: parsePct(c.def?.away) },
    poisson: {
      home: parsePct(c.poisson_distribution?.home),
      away: parsePct(c.poisson_distribution?.away),
    },
    overall: { home: parsePct(c.total?.home), away: parsePct(c.total?.away) },
  };
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
// Player profile — /players/profiles (bio physique)
// ============================================================================

type ProfileResponse = {
  response: Array<{
    player: {
      id: number;
      name: string;
      firstname: string | null;
      lastname: string | null;
      age: number | null;
      birth: {
        date: string | null;
        place: string | null;
        country: string | null;
      };
      nationality: string | null;
      height: string | null; // "174 cm"
      weight: string | null; // "72 kg"
      number: number | null;
      position: string | null;
      photo: string | null;
    };
  }>;
};

export type PlayerProfile = {
  height_cm: number | null;
  weight_kg: number | null;
  birth_date: string | null;
  birth_place: string | null;
  birth_country: string | null;
};

function parseUnit(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export async function fetchPlayerProfile(
  playerId: number,
): Promise<PlayerProfile | null> {
  const d = await af<ProfileResponse>(`/players/profiles?player=${playerId}`);
  const p = d.response[0]?.player;
  if (!p) return null;
  return {
    height_cm: parseUnit(p.height),
    weight_kg: parseUnit(p.weight),
    birth_date: p.birth.date,
    birth_place: p.birth.place,
    birth_country: p.birth.country,
  };
}

// ============================================================================
// Transferts — /transfers?player=X
// ============================================================================

type TransfersResponse = {
  response: Array<{
    player: { id: number; name: string };
    transfers: Array<{
      date: string;
      type: string | null; // "€ 23M", "Loan", "Free", null
      teams: {
        in: { id: number | null; name: string; logo: string | null };
        out: { id: number | null; name: string; logo: string | null };
      };
    }>;
  }>;
};

export type CareerTransfer = {
  date: string;
  type: string | null;
  from_team: string;
  from_team_logo: string | null;
  to_team: string;
  to_team_logo: string | null;
};

export async function fetchPlayerTransfers(
  playerId: number,
): Promise<CareerTransfer[]> {
  const d = await af<TransfersResponse>(`/transfers?player=${playerId}`);
  const list = d.response[0]?.transfers ?? [];
  // Tri du plus ancien au plus récent (= ordre carrière naturel)
  return list
    .map((t) => ({
      date: t.date,
      type: t.type,
      from_team: t.teams.out.name,
      from_team_logo: t.teams.out.logo,
      to_team: t.teams.in.name,
      to_team_logo: t.teams.in.logo,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================================
// Coach d'une équipe — /coachs?team=TEAM_ID (sélectionneurs CDM, etc.)
// ============================================================================

type CoachsResponse = {
  response: Array<{
    id: number;
    name: string;
    firstname: string | null;
    lastname: string | null;
    age: number | null;
    nationality: string | null;
    photo: string | null;
    team: { id: number; name: string } | null;
    career: Array<{
      team: { id: number; name: string } | null;
      start: string | null;
      end: string | null;
    }>;
  }>;
};

export type CoachInfo = {
  af_coach_id: number;
  name: string;
  nationality: string | null;
  photo: string | null;
  in_charge_since: string | null; // ISO date du dernier start sur cette équipe
};

export async function fetchCurrentCoach(
  afTeamId: number,
): Promise<CoachInfo | null> {
  const d = await af<CoachsResponse>(`/coachs?team=${afTeamId}`);
  // /coachs renvoie l'historique : on cherche celui en poste (end=null) qui
  // appartient à l'équipe demandée
  for (const c of d.response) {
    if (c.team?.id !== afTeamId) continue;
    const current = c.career.find(
      (k) => k.team?.id === afTeamId && (k.end == null || k.end === ''),
    );
    if (current) {
      return {
        af_coach_id: c.id,
        name: c.name,
        nationality: c.nationality,
        photo: c.photo,
        in_charge_since: current.start,
      };
    }
  }
  // Fallback : 1er coach renvoyé même sans match exact career.end=null
  const first = d.response[0];
  if (!first) return null;
  return {
    af_coach_id: first.id,
    name: first.name,
    nationality: first.nationality,
    photo: first.photo,
    in_charge_since: null,
  };
}

// ============================================================================
// Head-to-head — /fixtures/headtohead?h2h=A-B
// ============================================================================

type H2HFullResponse = {
  response: Array<{
    fixture: {
      id: number;
      date: string;
      status: { short: string };
    };
    league: { id: number; name: string; season: number };
    teams: {
      home: { id: number; name: string; winner: boolean | null };
      away: { id: number; name: string; winner: boolean | null };
    };
    goals: { home: number | null; away: number | null };
  }>;
};

export type H2HSummary = {
  total: number;
  a_wins: number;
  b_wins: number;
  draws: number;
  last_5: Array<{
    date: string; // YYYY-MM-DD
    competition: string;
    score: string; // "2-1"
    winner: 'a' | 'b' | 'draw';
    home_id: number;
    away_id: number;
  }>;
};

/**
 * Bilan tête-à-tête entre 2 équipes AF.
 * `teamA` est traitée comme "l'équipe de référence" (a_wins = victoires de A).
 */
export async function fetchHeadToHead(
  teamA: number,
  teamB: number,
  lastN = 5,
): Promise<H2HSummary> {
  const d = await af<H2HFullResponse>(
    `/fixtures/headtohead?h2h=${teamA}-${teamB}&status=FT-AET-PEN`,
  );
  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  for (const m of d.response) {
    const homeWin = m.teams.home.winner === true;
    const awayWin = m.teams.away.winner === true;
    if (!homeWin && !awayWin) {
      draws += 1;
      continue;
    }
    const winnerId = homeWin ? m.teams.home.id : m.teams.away.id;
    if (winnerId === teamA) aWins += 1;
    else if (winnerId === teamB) bWins += 1;
  }
  // Derniers N matchs, du plus récent au plus ancien
  const sorted = [...d.response].sort((x, y) =>
    y.fixture.date.localeCompare(x.fixture.date),
  );
  const last5 = sorted.slice(0, lastN).map((m) => {
    const homeWin = m.teams.home.winner === true;
    const awayWin = m.teams.away.winner === true;
    let winner: 'a' | 'b' | 'draw' = 'draw';
    if (homeWin || awayWin) {
      const winnerId = homeWin ? m.teams.home.id : m.teams.away.id;
      winner = winnerId === teamA ? 'a' : 'b';
    }
    return {
      date: m.fixture.date.slice(0, 10),
      competition: m.league.name,
      score: `${m.goals.home ?? '?'}-${m.goals.away ?? '?'}`,
      winner,
      home_id: m.teams.home.id,
      away_id: m.teams.away.id,
    };
  });
  return {
    total: d.response.length,
    a_wins: aWins,
    b_wins: bWins,
    draws,
    last_5: last5,
  };
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

  // Aggregated variant kept below
  performers.sort((a, b) => {
    const sA = a.goals + a.assists;
    const sB = b.goals + b.assists;
    if (sB !== sA) return sB - sA;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });

  return performers.slice(0, topN);
}

/**
 * Variante CDM : récupère tous les joueurs d'une sélection dans la
 * compétition Coupe du Monde (league=1 par défaut) pour une saison.
 * Cible la liste officielle CDM dès qu'elle est publiée par AF.
 *
 * Retourne TOUS les joueurs déclarés dans cette compétition pour cette
 * équipe (pas juste ceux ayant déjà joué — un joueur peut être listé
 * sans appearences avant le premier match).
 */
export async function fetchPlayersInLeague(
  teamId: number,
  leagueId: number,
  season: number,
): Promise<SquadPerformer[]> {
  const out: SquadPerformer[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 5) {
    const d = await af<PlayerSeasonResponse>(
      `/players?team=${teamId}&league=${leagueId}&season=${season}&page=${page}`,
    );
    totalPages = d.paging.total;

    for (const p of d.response) {
      const s = p.statistics.find((st) => st.league.id === leagueId);
      const position = s?.games.position ?? null;
      const appearances = s?.games.appearences ?? 0;
      const lineups = s?.games.lineups ?? 0;
      const minutes = s?.games.minutes ?? 0;
      const goals = s?.goals.total ?? 0;
      const assists = s?.goals.assists ?? 0;
      const yellow = s?.cards.yellow ?? 0;
      const red = s?.cards.red ?? 0;
      const ratingRaw = s?.games.rating;
      const rating = ratingRaw ? Number(ratingRaw) : null;

      out.push({
        player_id: p.player.id,
        player_name: p.player.name,
        photo: p.player.photo,
        position,
        is_captain: Boolean(s?.games.captain),
        appearances,
        lineups,
        minutes,
        goals,
        assists,
        rating: Number.isFinite(rating ?? NaN) ? rating : null,
        shots_on_target: null,
        key_passes: null,
        passes_accuracy: null,
        dribbles_success_ratio: null,
        duels_won_ratio: null,
        yellow_cards: yellow,
        red_cards: red,
        saves: null,
        goals_conceded: null,
      });
    }
    page += 1;
  }

  return out;
}

/**
 * Variante pour sélections nationales : agrège les stats sur TOUTES les
 * compétitions internationales (Friendlies, Nations League, qualifs, WC...)
 * pour une équipe nationale sur une saison. Renvoie un row par joueur.
 */
export async function fetchAggregatedTeamPerformers(
  teamId: number,
  season: number,
  topN = 100,
): Promise<SquadPerformer[]> {
  const performers: SquadPerformer[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 5) {
    const d = await af<PlayerSeasonResponse>(
      `/players?team=${teamId}&season=${season}&page=${page}`,
    );
    totalPages = d.paging.total;

    for (const p of d.response) {
      // Agrégation sur toutes les compétitions de la saison
      let appearances = 0;
      let lineups = 0;
      let minutes = 0;
      let goals = 0;
      let assists = 0;
      let yellow = 0;
      let red = 0;
      let position: string | null = null;
      let isCaptain = false;
      let ratingSum = 0;
      let ratingN = 0;

      for (const s of p.statistics) {
        if (!s.games.appearences || s.games.appearences === 0) continue;
        appearances += s.games.appearences;
        lineups += s.games.lineups ?? 0;
        minutes += s.games.minutes ?? 0;
        goals += s.goals.total ?? 0;
        assists += s.goals.assists ?? 0;
        yellow += s.cards.yellow ?? 0;
        red += s.cards.red ?? 0;
        if (!position && s.games.position) position = s.games.position;
        if (s.games.captain) isCaptain = true;
        if (s.games.rating) {
          const r = Number(s.games.rating);
          if (Number.isFinite(r)) {
            ratingSum += r;
            ratingN += 1;
          }
        }
      }

      if (appearances === 0) continue;

      performers.push({
        player_id: p.player.id,
        player_name: p.player.name,
        photo: p.player.photo,
        position,
        is_captain: isCaptain,
        appearances,
        lineups,
        minutes,
        goals,
        assists,
        rating: ratingN > 0 ? Math.round((ratingSum / ratingN) * 100) / 100 : null,
        shots_on_target: null,
        key_passes: null,
        passes_accuracy: null,
        dribbles_success_ratio: null,
        duels_won_ratio: null,
        yellow_cards: yellow,
        red_cards: red,
        saves: null,
        goals_conceded: null,
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
