// Contenu éditorial factuel sur la Coupe du Monde 2026.
// Centralisé ici pour être réutilisé par la page /coupe-du-monde-2026 et
// les pages-guides. Faits publics et stables — pas de pronostic.

export const WC_FACTS = {
  edition: '23ᵉ édition de la Coupe du Monde de la FIFA',
  startDate: '2026-06-11',
  endDate: '2026-07-19',
  startLabel: '11 juin 2026',
  endLabel: '19 juillet 2026',
  teams: 48,
  groups: 12,
  teamsPerGroup: 4,
  matches: 104,
  hostCountries: ['États-Unis', 'Canada', 'Mexique'],
  hostCitiesCount: 16,
  openingVenue: 'Estadio Azteca, Mexico',
  finalVenue: 'MetLife Stadium, New York / New Jersey',
  defendingChampion: 'Argentine',
} as const;

export type HostCity = {
  city: string;
  country: 'États-Unis' | 'Canada' | 'Mexique';
  stadium: string;
};

// 16 villes hôtes réparties sur les 3 pays organisateurs.
export const WC_HOST_CITIES: HostCity[] = [
  { city: 'Mexico', country: 'Mexique', stadium: 'Estadio Azteca' },
  { city: 'Guadalajara', country: 'Mexique', stadium: 'Estadio Akron' },
  { city: 'Monterrey', country: 'Mexique', stadium: 'Estadio BBVA' },
  { city: 'Toronto', country: 'Canada', stadium: 'BMO Field' },
  { city: 'Vancouver', country: 'Canada', stadium: 'BC Place' },
  { city: 'Atlanta', country: 'États-Unis', stadium: 'Mercedes-Benz Stadium' },
  { city: 'Boston', country: 'États-Unis', stadium: 'Gillette Stadium' },
  { city: 'Dallas', country: 'États-Unis', stadium: 'AT&T Stadium' },
  { city: 'Houston', country: 'États-Unis', stadium: 'NRG Stadium' },
  { city: 'Kansas City', country: 'États-Unis', stadium: 'Arrowhead Stadium' },
  {
    city: 'Los Angeles',
    country: 'États-Unis',
    stadium: 'SoFi Stadium',
  },
  { city: 'Miami', country: 'États-Unis', stadium: 'Hard Rock Stadium' },
  {
    city: 'New York / New Jersey',
    country: 'États-Unis',
    stadium: 'MetLife Stadium',
  },
  {
    city: 'Philadelphie',
    country: 'États-Unis',
    stadium: 'Lincoln Financial Field',
  },
  {
    city: 'San Francisco Bay Area',
    country: 'États-Unis',
    stadium: "Levi's Stadium",
  },
  { city: 'Seattle', country: 'États-Unis', stadium: 'Lumen Field' },
];

// Étapes du tournoi, dans l'ordre.
export const WC_STAGES: Array<{ label: string; detail: string }> = [
  {
    label: 'Phase de groupes',
    detail:
      '12 groupes de 4 équipes. Chaque sélection joue 3 matchs. Les 2 premiers de chaque groupe et les 8 meilleurs troisièmes sont qualifiés.',
  },
  {
    label: '16ᵉ de finale',
    detail:
      '32 équipes qualifiées s’affrontent en élimination directe — une nouveauté du format à 48.',
  },
  {
    label: '8ᵉ de finale',
    detail: '16 équipes restantes.',
  },
  {
    label: 'Quarts de finale',
    detail: '8 équipes restantes.',
  },
  {
    label: 'Demi-finales',
    detail: '4 équipes restantes.',
  },
  {
    label: 'Finale',
    detail:
      'Le 19 juillet 2026 au MetLife Stadium de New York / New Jersey. Un match pour la 3ᵉ place est joué la veille.',
  },
];

// FAQ — questions factuelles. Sert aussi au JSON-LD FAQPage (citations IA).
export const WC_FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Quand a lieu la Coupe du Monde 2026 ?',
    a: 'La Coupe du Monde 2026 se déroule du 11 juin au 19 juillet 2026, soit un peu plus de cinq semaines de compétition.',
  },
  {
    q: 'Où se déroule la Coupe du Monde 2026 ?',
    a: "Le tournoi est organisé conjointement par trois pays — les États-Unis, le Canada et le Mexique — répartis sur 16 villes hôtes. C'est la première Coupe du Monde co-organisée par trois nations.",
  },
  {
    q: 'Combien d’équipes participent à la Coupe du Monde 2026 ?',
    a: '48 sélections participent à la Coupe du Monde 2026, contre 32 lors des éditions précédentes. C’est la première Coupe du Monde au format à 48 équipes.',
  },
  {
    q: 'Comment fonctionne le format à 48 équipes ?',
    a: 'Les 48 équipes sont réparties en 12 groupes de 4. Les deux premiers de chaque groupe et les huit meilleurs troisièmes — soit 32 équipes — se qualifient pour une phase à élimination directe qui débute par les 16ᵉ de finale.',
  },
  {
    q: 'Combien de matchs sont joués pendant la Coupe du Monde 2026 ?',
    a: '104 matchs sont disputés au total, contre 64 au format précédent à 32 équipes.',
  },
  {
    q: 'Où se joue la finale de la Coupe du Monde 2026 ?',
    a: 'La finale a lieu le 19 juillet 2026 au MetLife Stadium de New York / New Jersey, aux États-Unis.',
  },
  {
    q: 'Quel est le match d’ouverture de la Coupe du Monde 2026 ?',
    a: 'La compétition s’ouvre le 11 juin 2026 à l’Estadio Azteca de Mexico, qui accueille le premier match du tournoi.',
  },
  {
    q: 'Qui est le tenant du titre ?',
    a: "L'Argentine est la tenante du titre : elle a remporté la Coupe du Monde 2022 au Qatar face à la France.",
  },
];
