// Compétitions trackées par les cron jobs. Codes Football-Data.org v4.
// Couverture MVP : top 5 européen + Champions League + Coupe du Monde 2026.
//
// `af_league_id` = identifiant côté API-Football. Utilisé pour le mapping
// FD↔AF des équipes/joueurs et pour les requêtes d'enrichissement (squads,
// stats, lineups). Source : https://dashboard.api-football.com/soccer/ids
// (Premier League=39, La Liga=140, Bundesliga=78, Serie A=135, Ligue 1=61,
// Champions League=2, World Cup=1).

export const TRACKED_COMPETITIONS = [
  { code: 'WC', label: 'FIFA World Cup', fd_id: 2000, af_league_id: 1 },
  { code: 'CL', label: 'UEFA Champions League', fd_id: 2001, af_league_id: 2 },
  { code: 'PL', label: 'Premier League', fd_id: 2021, af_league_id: 39 },
  { code: 'PD', label: 'La Liga', fd_id: 2014, af_league_id: 140 },
  { code: 'BL1', label: 'Bundesliga', fd_id: 2002, af_league_id: 78 },
  { code: 'SA', label: 'Serie A', fd_id: 2019, af_league_id: 135 },
  { code: 'FL1', label: 'Ligue 1', fd_id: 2015, af_league_id: 61 },
] as const;

export type TrackedCompetitionCode =
  (typeof TRACKED_COMPETITIONS)[number]['code'];

// Lookup FD competition_id → AF league_id (utilisé par les mappers et scripts).
export const FD_TO_AF_LEAGUE: Record<number, number> = Object.fromEntries(
  TRACKED_COMPETITIONS.map((c) => [c.fd_id, c.af_league_id]),
);
