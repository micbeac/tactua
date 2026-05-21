// Score de précision des analyses IA pré-match.
// Compare les prédictions stockées dans match_analyses.content_json
// aux résultats réels des matchs finished.

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DeepPreMatchAnalysis,
  PreMatchAnalysis,
} from '@/lib/openai/types';
import type { Database } from '@/types/database';

export type WinnerOutcome = 'home' | 'draw' | 'away';

export type MatchPredictionScore = {
  match_id: number;
  kickoff_at: string;
  home_name: string;
  away_name: string;
  home_logo: string | null;
  away_logo: string | null;
  actual_home: number;
  actual_away: number;
  actual_winner: WinnerOutcome;
  // Prédictions extraites
  predicted_winner: WinnerOutcome | null;
  predicted_scoreline: { home: number; away: number } | null;
  predicted_btts: 'yes' | 'no' | null;
  predicted_over_2_5: 'yes' | 'no' | null;
  confidence: 'low' | 'medium' | 'high' | null;
  // Résultats (true = bonne réponse, null = pas de prédiction sur ce point)
  winner_correct: boolean | null;
  scoreline_correct: boolean | null;
  btts_correct: boolean | null;
  over_2_5_correct: boolean | null;
  // Score pondéré (0-100) du match
  score: number;
};

export type AggregateScore = {
  total_matches: number;
  global_score: number; // 0-100
  winner_accuracy: number | null; // %
  scoreline_accuracy: number | null;
  btts_accuracy: number | null;
  over_2_5_accuracy: number | null;
  by_confidence: {
    high: { count: number; winner_accuracy: number | null };
    medium: { count: number; winner_accuracy: number | null };
    low: { count: number; winner_accuracy: number | null };
  };
};

function parseScoreline(s: string): { home: number; away: number } | null {
  if (!s) return null;
  const m = s.match(/(\d+)\s*[-–:]\s*(\d+)/);
  if (!m) return null;
  return { home: Number(m[1]), away: Number(m[2]) };
}

function outcomeFromScore(h: number, a: number): WinnerOutcome {
  if (h > a) return 'home';
  if (h < a) return 'away';
  return 'draw';
}

function winnerFromProbabilities(
  probs: { home_win: number; draw: number; away_win: number } | undefined,
): WinnerOutcome | null {
  if (!probs) return null;
  const max = Math.max(probs.home_win, probs.draw, probs.away_win);
  if (probs.home_win === max) return 'home';
  if (probs.away_win === max) return 'away';
  return 'draw';
}

/**
 * Calcule un score de prédiction pour un match terminé.
 * Pondération :
 *   - vainqueur correct : 50 pts
 *   - score exact : 30 pts (bonus, en plus du vainqueur)
 *   - BTTS correct : 10 pts
 *   - Over 2.5 correct : 10 pts
 * Si une dimension n'est pas prédite, ses points sont retirés du total
 * possible (ratio sur le dispo). Le score retourné est /100.
 */
export function scoreMatch(
  content: PreMatchAnalysis | DeepPreMatchAnalysis,
  actualHome: number,
  actualAway: number,
): {
  predicted_winner: WinnerOutcome | null;
  predicted_scoreline: { home: number; away: number } | null;
  predicted_btts: 'yes' | 'no' | null;
  predicted_over_2_5: 'yes' | 'no' | null;
  confidence: 'low' | 'medium' | 'high' | null;
  winner_correct: boolean | null;
  scoreline_correct: boolean | null;
  btts_correct: boolean | null;
  over_2_5_correct: boolean | null;
  score: number;
} {
  const actualWinner = outcomeFromScore(actualHome, actualAway);
  const actualBtts = actualHome > 0 && actualAway > 0 ? 'yes' : 'no';
  const actualOver25 = actualHome + actualAway > 2.5 ? 'yes' : 'no';

  const deep = content as DeepPreMatchAnalysis;
  const isDeep = 'data_insight' in (content as object);

  const predictedScoreline = parseScoreline(
    content.prediction?.scoreline_guess ?? '',
  );
  const predictedWinnerFromProbs = isDeep
    ? winnerFromProbabilities(deep.prediction?.probabilities)
    : null;
  const predictedWinner =
    predictedWinnerFromProbs ??
    (predictedScoreline
      ? outcomeFromScore(predictedScoreline.home, predictedScoreline.away)
      : null);

  const predictedBtts = isDeep ? (deep.prediction?.btts ?? null) : null;
  const predictedOver25 = isDeep ? (deep.prediction?.over_2_5 ?? null) : null;
  const confidence = isDeep ? (deep.prediction?.confidence ?? null) : null;

  const winnerCorrect =
    predictedWinner === null ? null : predictedWinner === actualWinner;
  const scorelineCorrect =
    predictedScoreline === null
      ? null
      : predictedScoreline.home === actualHome &&
        predictedScoreline.away === actualAway;
  const bttsCorrect =
    predictedBtts === null ? null : predictedBtts === actualBtts;
  const over25Correct =
    predictedOver25 === null ? null : predictedOver25 === actualOver25;

  // Score pondéré
  let earned = 0;
  let possible = 0;
  if (winnerCorrect !== null) {
    possible += 50;
    if (winnerCorrect) earned += 50;
  }
  if (scorelineCorrect !== null) {
    possible += 30;
    if (scorelineCorrect) earned += 30;
  }
  if (bttsCorrect !== null) {
    possible += 10;
    if (bttsCorrect) earned += 10;
  }
  if (over25Correct !== null) {
    possible += 10;
    if (over25Correct) earned += 10;
  }
  const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;

  return {
    predicted_winner: predictedWinner,
    predicted_scoreline: predictedScoreline,
    predicted_btts: predictedBtts,
    predicted_over_2_5: predictedOver25,
    confidence,
    winner_correct: winnerCorrect,
    scoreline_correct: scorelineCorrect,
    btts_correct: bttsCorrect,
    over_2_5_correct: over25Correct,
    score,
  };
}

type AnalysisRow = {
  match_id: number;
  content_json: unknown;
};

type MatchRow = {
  id: number;
  kickoff_at: string;
  score_home: number | null;
  score_away: number | null;
  home_team: { id: number; name: string; logo_url: string | null } | null;
  away_team: { id: number; name: string; logo_url: string | null } | null;
};

/**
 * Récupère tous les matchs finished avec une analyse pré-match,
 * calcule le score de précision pour chacun, et agrège.
 */
export async function getPrecisionScores(
  supabase: SupabaseClient<Database>,
  limit = 100,
): Promise<{
  matches: MatchPredictionScore[];
  aggregate: AggregateScore;
}> {
  // 1. Tous les matchs finished récents
  const { data: matchData, error: matchError } = await supabase
    .from('matches')
    .select(
      `id, kickoff_at, score_home, score_away,
       home_team:teams!matches_home_team_id_fkey(id, name, logo_url),
       away_team:teams!matches_away_team_id_fkey(id, name, logo_url)`,
    )
    .eq('status', 'finished')
    .not('score_home', 'is', null)
    .not('score_away', 'is', null)
    .order('kickoff_at', { ascending: false })
    .limit(limit);

  if (matchError) {
    console.error('[precision] matches error', matchError);
    return { matches: [], aggregate: emptyAggregate() };
  }
  const matches = (matchData ?? []) as unknown as MatchRow[];
  if (matches.length === 0) return { matches: [], aggregate: emptyAggregate() };

  const matchIds = matches.map((m) => m.id);
  const { data: analysisData, error: anError } = await supabase
    .from('match_analyses')
    .select('match_id, content_json')
    .eq('type', 'pre_match')
    .in('match_id', matchIds);

  if (anError) {
    console.error('[precision] analyses error', anError);
    return { matches: [], aggregate: emptyAggregate() };
  }
  const analyses = new Map<number, AnalysisRow>();
  for (const a of (analysisData ?? []) as AnalysisRow[]) {
    analyses.set(a.match_id, a);
  }

  const scored: MatchPredictionScore[] = [];
  for (const m of matches) {
    const an = analyses.get(m.id);
    if (!an || !an.content_json) continue;
    if (m.score_home == null || m.score_away == null) continue;
    const content = an.content_json as PreMatchAnalysis | DeepPreMatchAnalysis;
    const s = scoreMatch(content, m.score_home, m.score_away);
    scored.push({
      match_id: m.id,
      kickoff_at: m.kickoff_at,
      home_name: m.home_team?.name ?? 'Domicile',
      away_name: m.away_team?.name ?? 'Extérieur',
      home_logo: m.home_team?.logo_url ?? null,
      away_logo: m.away_team?.logo_url ?? null,
      actual_home: m.score_home,
      actual_away: m.score_away,
      actual_winner: outcomeFromScore(m.score_home, m.score_away),
      ...s,
    });
  }

  return { matches: scored, aggregate: aggregate(scored) };
}

function emptyAggregate(): AggregateScore {
  return {
    total_matches: 0,
    global_score: 0,
    winner_accuracy: null,
    scoreline_accuracy: null,
    btts_accuracy: null,
    over_2_5_accuracy: null,
    by_confidence: {
      high: { count: 0, winner_accuracy: null },
      medium: { count: 0, winner_accuracy: null },
      low: { count: 0, winner_accuracy: null },
    },
  };
}

function aggregate(scored: MatchPredictionScore[]): AggregateScore {
  if (scored.length === 0) return emptyAggregate();
  const pct = (truthy: number, total: number) =>
    total === 0 ? null : Math.round((truthy / total) * 100);
  const winnerScored = scored.filter((s) => s.winner_correct !== null);
  const scoreScored = scored.filter((s) => s.scoreline_correct !== null);
  const bttsScored = scored.filter((s) => s.btts_correct !== null);
  const overScored = scored.filter((s) => s.over_2_5_correct !== null);

  const byConf = (level: 'low' | 'medium' | 'high') => {
    const subset = scored.filter(
      (s) => s.confidence === level && s.winner_correct !== null,
    );
    return {
      count: subset.length,
      winner_accuracy: pct(
        subset.filter((s) => s.winner_correct === true).length,
        subset.length,
      ),
    };
  };

  const globalScore = Math.round(
    scored.reduce((sum, s) => sum + s.score, 0) / scored.length,
  );

  return {
    total_matches: scored.length,
    global_score: globalScore,
    winner_accuracy: pct(
      winnerScored.filter((s) => s.winner_correct === true).length,
      winnerScored.length,
    ),
    scoreline_accuracy: pct(
      scoreScored.filter((s) => s.scoreline_correct === true).length,
      scoreScored.length,
    ),
    btts_accuracy: pct(
      bttsScored.filter((s) => s.btts_correct === true).length,
      bttsScored.length,
    ),
    over_2_5_accuracy: pct(
      overScored.filter((s) => s.over_2_5_correct === true).length,
      overScored.length,
    ),
    by_confidence: {
      high: byConf('high'),
      medium: byConf('medium'),
      low: byConf('low'),
    },
  };
}
