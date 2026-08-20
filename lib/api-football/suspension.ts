// Seuils de suspension pour accumulation de cartons jaunes.
//
// Chaque compétition fixe le nombre d'avertissements entraînant un match de
// suspension. Un joueur à une unité du seuil joue sous menace : c'est une
// information très concrète pour un match à venir, et absente de la plupart
// des sites d'analyse.
//
// ⚠️ Ces seuils sont ceux communément appliqués, mais ils relèvent du
// règlement de chaque compétition et peuvent évoluer d'une saison à l'autre.
// Ils portent aussi sur le premier palier : les suivants sont généralement
// plus espacés. En cas de doute, mieux vaut ne rien annoncer — d'où le
// `null` par défaut pour toute compétition non répertoriée.

/** league_id API-Football → nombre de jaunes déclenchant la 1re suspension. */
const THRESHOLD_BY_AF_LEAGUE: Record<number, number> = {
  1: 2, // Coupe du Monde
  2: 3, // Ligue des champions
  39: 5, // Premier League
  61: 3, // Ligue 1
  78: 5, // Bundesliga
  135: 5, // Serie A
  140: 5, // La Liga
  144: 5, // Jupiler Pro League
};

export type SuspensionRisk = {
  player_name: string;
  yellow_cards: number;
  threshold: number;
};

/**
 * Joueurs à UN carton du seuil de suspension.
 *
 * Volontairement strict : on ne signale que le palier immédiat. Annoncer à
 * tort qu'un joueur risque la suspension est pire que de ne rien dire.
 */
export function findSuspensionRisks(
  players: Array<{ player_name: string; yellow_cards: number }>,
  afLeagueId: number,
): SuspensionRisk[] {
  const threshold = THRESHOLD_BY_AF_LEAGUE[afLeagueId];
  if (!threshold) return [];

  return players
    .filter((p) => p.yellow_cards === threshold - 1)
    .map((p) => ({
      player_name: p.player_name,
      yellow_cards: p.yellow_cards,
      threshold,
    }))
    .sort((a, b) => a.player_name.localeCompare(b.player_name));
}
