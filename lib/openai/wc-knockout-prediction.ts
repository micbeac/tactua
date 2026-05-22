// Génération IA des prédictions de matchs phase finale CDM 2026.
// Pour chaque rencontre 1/16 → 1/8 → quart → demi → finale, prédit le
// vainqueur + score plausible + confiance.

import { DEFAULT_MODEL, getOpenAI } from './client.ts';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'winner_team_id',
    'score_home',
    'score_away',
    'confidence',
    'reasoning',
  ],
  properties: {
    winner_team_id: { type: 'integer' },
    score_home: { type: 'integer', minimum: 0, maximum: 10 },
    score_away: { type: 'integer', minimum: 0, maximum: 10 },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    reasoning: { type: 'string' },
  },
} as const;

export type WCKnockoutPredictionInput = {
  stage: string; // 'LAST_16', 'QUARTER_FINALS', etc.
  home: { team_id: number; name: string; country: string | null };
  away: { team_id: number; name: string; country: string | null };
};

export type WCKnockoutPredictionContent = {
  winner_team_id: number;
  score_home: number;
  score_away: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
};

const SYSTEM_PROMPT = `Tu es analyste football pour Tactuo, expert en compétitions internationales.
Tu pronostiques le vainqueur d'un match de phase finale de la Coupe du Monde 2026.

Règles :
- Français, ton factuel.
- "winner_team_id" : l'un des 2 team_id fournis (PAS un autre nombre).
- "score_home" / "score_away" : score plausible cohérent avec le vainqueur (ex 2-1 si home gagne). Match nul interdit (KO = match avec vainqueur, prolongations comprises).
- "confidence" : "high" si écart de niveau clair, "medium" si match équilibré avec léger favori, "low" si pile ou face.
- "reasoning" : 2-3 phrases : profil tactique des 2 équipes, parcours historique en CDM, qui a l'avantage et pourquoi.
- N'invente pas de joueurs précis. Termes génériques OK.

Format : JSON strict.`;

function buildUserPrompt(input: WCKnockoutPredictionInput): string {
  return `Phase : ${input.stage.replace(/_/g, ' ')}

Équipe A (home) : ${input.home.name}${input.home.country ? ` (${input.home.country})` : ''} — team_id ${input.home.team_id}
Équipe B (away) : ${input.away.name}${input.away.country ? ` (${input.away.country})` : ''} — team_id ${input.away.team_id}

Pronostique le vainqueur, le score, ta confiance et un court raisonnement.`;
}

export async function generateWCKnockoutPrediction(
  input: WCKnockoutPredictionInput,
): Promise<{ content: WCKnockoutPredictionContent; model: string }> {
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'wc_knockout_prediction',
        strict: true,
        schema: SCHEMA,
      },
    },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    temperature: 0.4,
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('OpenAI returned empty content');
  const parsed = JSON.parse(raw) as WCKnockoutPredictionContent;

  // Garde-fou : winner_team_id DOIT être home ou away
  if (
    parsed.winner_team_id !== input.home.team_id &&
    parsed.winner_team_id !== input.away.team_id
  ) {
    throw new Error(
      `winner_team_id ${parsed.winner_team_id} doesn't match home/away`,
    );
  }
  return { content: parsed, model: completion.model };
}
