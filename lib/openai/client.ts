import OpenAI from 'openai';

// Modèle par défaut : gpt-4o-mini. Rapport coût/qualité optimal pour les
// usages "volume" (résumés news, analyse simple, post-match).
export const DEFAULT_MODEL = 'gpt-4o-mini';

// Modèle "premium" réservé à l'analyse pré-match approfondie (l'artefact
// vu par l'utilisateur payant). L'analyse est petite et mise en cache par
// match → quelques € à quelques dizaines d'€ / mois max.
// Surchargeable via OPENAI_DEEP_MODEL (ex repli gpt-4o si besoin).
export const DEEP_MODEL = process.env.OPENAI_DEEP_MODEL || 'gpt-5.5';

/** true si le modèle est un modèle de raisonnement (GPT-5+, série o) :
 *  ils n'acceptent pas de `temperature` personnalisé. */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/i.test(model);
}

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
