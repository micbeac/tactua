// Saison en cours, au format attendu par API-Football : l'année de DÉBUT de
// la saison (2026 désigne la saison 2026-27).
//
// Les championnats européens démarrent en juillet/août et se terminent en mai.
// On bascule donc au 1er juillet : de juillet à décembre, la saison est
// l'année courante ; de janvier à juin, c'est l'année précédente.
//
// Volontairement calculé et non figé : une constante `SEASON = 2025` traînait
// dans le cron refresh-player-stats et aurait fait chercher les stats de
// 2025-26 pendant toute la saison 2026-27.

/** Mois (1-12) à partir duquel on considère la nouvelle saison démarrée. */
const SEASON_ROLLOVER_MONTH = 7;

export function currentSeason(now: Date = new Date()): number {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // getUTCMonth() est 0-indexé
  return month >= SEASON_ROLLOVER_MONTH ? year : year - 1;
}

/** Libellé lisible : 2026 → « 2026-27 ». */
export function seasonLabel(season: number = currentSeason()): string {
  return `${season}-${String((season + 1) % 100).padStart(2, '0')}`;
}
