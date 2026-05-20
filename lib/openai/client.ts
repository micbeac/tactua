import OpenAI from 'openai';

// Modèle par défaut : gpt-4o-mini. Rapport coût/qualité optimal pour les
// analyses pré/post-match d'après le plan.
export const DEFAULT_MODEL = 'gpt-4o-mini';

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY manquant dans les variables d'environnement.",
    );
  }
  _client = new OpenAI({ apiKey });
  return _client;
}
