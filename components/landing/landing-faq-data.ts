// Données de la FAQ landing — extraites du composant pour pouvoir être
// importées depuis un Server Component (app/page.tsx → JSON-LD FAQPage).
// Un module "use client" expose ses valeurs sous forme de référence client,
// pas la donnée réelle, ce qui casse `.map()` côté serveur.

export const LANDING_FAQ = [
  {
    q: 'Comment fonctionne l’IA ?',
    a: 'On combine plusieurs sources de données football (stats équipes, performances joueurs, blessures, compositions), puis on les passe à un modèle GPT-4o-mini avec des consignes strictes. Le modèle ne devine rien : il synthétise ce que les chiffres disent.',
  },
  {
    q: 'C’est gratuit ?',
    a: 'Oui. La création de compte, les favoris, les analyses et les notifications sont gratuits. Un plan payant avec analyses illimitées et détaillées arrivera plus tard — les comptes existants seront prévenus à l’avance.',
  },
  {
    q: 'Est-ce que c’est une app de paris sportifs ?',
    a: 'Non. Tactuo positionne l’analyse comme un outil de compréhension : "voici tout ce qu’il faut savoir avant le match". On donne des probabilités et des scénarios, jamais de conseil de pari.',
  },
  {
    q: 'Quelles compétitions sont couvertes ?',
    a: 'Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League et Jupiler Pro League, suivies en direct sur toute la saison 2026-27. La Coupe du Monde 2026 reste consultable en archive, avec l’intégralité des résultats et des analyses des 104 matchs.',
  },
  {
    q: 'Mes données sont-elles fiables ?',
    a: 'Football-Data.org pour la structure (calendrier, classements), API-Football Pro pour les stats détaillées et compositions officielles. Mises à jour quotidiennes.',
  },
];
