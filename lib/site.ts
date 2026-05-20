// Constantes branding centralisées. Toute la marque + URL passe par ici pour
// éviter les hard-codes dispersés.
//
// Pour migrer vers le domaine custom :
//   1. Ajouter NEXT_PUBLIC_SITE_URL=https://tactuo.com dans Vercel env vars
//   2. Redeploy
// Tant que la var n'est pas définie, on retombe sur le sous-domaine Vercel.

export const SITE_NAME = 'Tactuo';

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tactua.vercel.app';

export const SITE_DESCRIPTION =
  "Tout ce qu'il faut comprendre avant le match : compositions, analyses tactiques IA, classements, stats joueurs et équipes.";
