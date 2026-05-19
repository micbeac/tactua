// Compétitions trackées par les cron jobs. Codes Football-Data.org v4.
// Couverture MVP : top 5 européen + Champions League + Coupe du Monde 2026.

export const TRACKED_COMPETITIONS = [
  { code: 'WC', label: 'FIFA World Cup' },
  { code: 'CL', label: 'UEFA Champions League' },
  { code: 'PL', label: 'Premier League' },
  { code: 'PD', label: 'La Liga' },
  { code: 'BL1', label: 'Bundesliga' },
  { code: 'SA', label: 'Serie A' },
  { code: 'FL1', label: 'Ligue 1' },
] as const;

export type TrackedCompetitionCode =
  (typeof TRACKED_COMPETITIONS)[number]['code'];
