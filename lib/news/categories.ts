// Catégories éditoriales des actualités clubs.
//
// Fichier séparé des actions serveur : un module « use server » ne peut
// exporter que des fonctions asynchrones, or ces constantes sont utilisées
// aussi bien par le back-office que par le fil public.
//
// ⚠️ Doit rester aligné sur l'énumération du schéma de génération
// (lib/openai/news-content.ts) : le modèle ne peut produire que ces valeurs.

export const NEWS_CATEGORIES = [
  'mercato',
  'avant_match',
  'blessure',
  'resultat',
  'club',
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<NewsCategory, string> = {
  mercato: 'Mercato',
  avant_match: 'Avant-match',
  blessure: 'Blessures',
  resultat: 'Résultats',
  club: 'Vie du club',
};
