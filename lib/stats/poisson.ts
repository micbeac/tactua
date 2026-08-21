// Estimation probabiliste maison, indépendante du marché.
//
// Pourquoi ce fichier existe : on fournissait le consensus des marchés au
// modèle en lui demandant de « pondérer avec sa propre lecture ». Il recopiait
// le consensus à l'identique — 45/28/27 en face de 45/28/27, écart nul sur les
// trois issues. Un tableau qui compare une valeur à elle-même n'apprend rien
// au lecteur, et la promesse éditoriale (« l'écart entre notre lecture
// statistique et le marché ») devenait creuse.
//
// D'où une estimation calculée, déterministe et explicable : deux lois de
// Poisson indépendantes, paramétrées par les moyennes de buts marqués et
// encaissés des deux équipes. C'est le modèle standard du football — grossier
// sur les corrélations (les deux scores ne sont pas vraiment indépendants),
// mais honnête, reproductible, et surtout NON ancré sur le marché.

/** Buts maximum considérés par équipe : au-delà, la masse est négligeable. */
const MAX_GOALS = 8;

/** Avantage du terrain, en multiplicateur sur l'espérance de buts locale. */
const HOME_ADVANTAGE = 1.15;

/** Bornes d'espérance de buts, pour écarter les valeurs aberrantes. */
const MIN_LAMBDA = 0.2;
const MAX_LAMBDA = 4.0;

function factorial(n: number): number {
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
}

/** P(X = k) pour X suivant une loi de Poisson de paramètre lambda. */
function poissonPmf(k: number, lambda: number): number {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

function clampLambda(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return MIN_LAMBDA;
  return Math.min(MAX_LAMBDA, Math.max(MIN_LAMBDA, v));
}

export type TeamScoringProfile = {
  goals_for_avg: number;
  goals_against_avg: number;
};

export type OutcomeProbabilities = {
  home_win: number;
  draw: number;
  away_win: number;
  /** Espérances de buts retenues, pour pouvoir expliquer le calcul. */
  lambda_home: number;
  lambda_away: number;
  btts_yes: number;
  over_2_5: number;
};

/**
 * Probabilités d'issue à partir des profils offensif et défensif des deux
 * équipes.
 *
 * L'espérance de buts d'une équipe combine sa production offensive et la
 * perméabilité de son adversaire : une attaque à 2 buts par match n'a pas la
 * même espérance face à une défense qui en encaisse 2 que face à une qui en
 * encaisse 0,5.
 */
export function computeOutcomeProbabilities(
  home: TeamScoringProfile,
  away: TeamScoringProfile,
): OutcomeProbabilities {
  const lambdaHome = clampLambda(
    ((home.goals_for_avg + away.goals_against_avg) / 2) * HOME_ADVANTAGE,
  );
  const lambdaAway = clampLambda(
    (away.goals_for_avg + home.goals_against_avg) / 2,
  );

  const homeProbs = Array.from({ length: MAX_GOALS + 1 }, (_, k) =>
    poissonPmf(k, lambdaHome),
  );
  const awayProbs = Array.from({ length: MAX_GOALS + 1 }, (_, k) =>
    poissonPmf(k, lambdaAway),
  );

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let bttsYes = 0;
  let over25 = 0;

  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = homeProbs[h] * awayProbs[a];
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
      if (h > 0 && a > 0) bttsYes += p;
      if (h + a > 2.5) over25 += p;
    }
  }

  // La troncature à 8 buts laisse une masse résiduelle : on renormalise.
  const total = homeWin + draw + awayWin;
  const h = Math.round((homeWin / total) * 100);
  const a = Math.round((awayWin / total) * 100);
  // L'arrondi peut décaler la somme d'un point : on rattrape sur le nul,
  // l'issue la moins sensible à cette unité.
  const d = 100 - h - a;

  return {
    home_win: h,
    draw: d,
    away_win: a,
    lambda_home: Math.round(lambdaHome * 100) / 100,
    lambda_away: Math.round(lambdaAway * 100) / 100,
    btts_yes: Math.round((bttsYes / total) * 100),
    over_2_5: Math.round((over25 / total) * 100),
  };
}
