import OpenAI from 'openai';

// Modèle par défaut : gpt-4o-mini. Rapport coût/qualité optimal pour les
// usages "volume" (résumés news, analyse simple, post-match).
export const DEFAULT_MODEL = 'gpt-4o-mini';

// Modèle "premium" réservé à l'analyse pré-match approfondie (l'artefact
// vu par l'utilisateur payant). ~15-17× le coût du mini par token mais
// l'analyse est petite et mise en cache → quelques € / mois max.
// Surchargeable via OPENAI_DEEP_MODEL si un flagship plus récent est dispo.
export const DEEP_MODEL = process.env.OPENAI_DEEP_MODEL || 'gpt-4o';

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
