// Noms français des sélections nationales.
//
// Les deux sources de données (Football-Data et API-Football) renvoient les
// noms en anglais : la base contient « Spain », « Netherlands », « Ivory
// Coast ». Sur un site francophone, afficher « Spain a remporté la Coupe du
// Monde » est un problème de qualité — et de référencement, puisque les
// requêtes visées sont « Espagne », « Pays-Bas », « Côte d'Ivoire ».
//
// L'indexation se fait sur le SLUG, pas sur le nom brut : slugify() supprime
// accents et casse, donc « Curaçao », « Curacao » et « CURAÇAO » tombent tous
// sur la même clé. Une correspondance par chaîne exacte casserait au moindre
// changement de graphie côté API.
//
// Ne couvre que les sélections. Les clubs gardent leur nom d'origine, qui ne
// se traduit pas (« Manchester City », « Real Madrid »).

import { slugify } from './url';

const FR_BY_SLUG: Record<string, string> = {
  // Les 48 sélections de la Coupe du Monde 2026
  algeria: 'Algérie',
  argentina: 'Argentine',
  australia: 'Australie',
  austria: 'Autriche',
  belgium: 'Belgique',
  'bosnia-herzegovina': 'Bosnie-Herzégovine',
  brazil: 'Brésil',
  canada: 'Canada',
  'cape-verde-islands': 'Cap-Vert',
  colombia: 'Colombie',
  'congo-dr': 'RD Congo',
  croatia: 'Croatie',
  curacao: 'Curaçao',
  czechia: 'Tchéquie',
  ecuador: 'Équateur',
  egypt: 'Égypte',
  england: 'Angleterre',
  france: 'France',
  germany: 'Allemagne',
  ghana: 'Ghana',
  haiti: 'Haïti',
  iran: 'Iran',
  iraq: 'Irak',
  'ivory-coast': 'Côte d’Ivoire',
  japan: 'Japon',
  jordan: 'Jordanie',
  mexico: 'Mexique',
  morocco: 'Maroc',
  netherlands: 'Pays-Bas',
  'new-zealand': 'Nouvelle-Zélande',
  norway: 'Norvège',
  panama: 'Panama',
  paraguay: 'Paraguay',
  portugal: 'Portugal',
  qatar: 'Qatar',
  'saudi-arabia': 'Arabie saoudite',
  scotland: 'Écosse',
  senegal: 'Sénégal',
  'south-africa': 'Afrique du Sud',
  'south-korea': 'Corée du Sud',
  spain: 'Espagne',
  sweden: 'Suède',
  switzerland: 'Suisse',
  tunisia: 'Tunisie',
  turkey: 'Turquie',
  'united-states': 'États-Unis',
  uruguay: 'Uruguay',
  uzbekistan: 'Ouzbékistan',

  // Sélections hors CDM 2026, rencontrées via les amicaux internationaux
  albania: 'Albanie',
  armenia: 'Arménie',
  azerbaijan: 'Azerbaïdjan',
  belarus: 'Biélorussie',
  bolivia: 'Bolivie',
  bulgaria: 'Bulgarie',
  cameroon: 'Cameroun',
  chile: 'Chili',
  china: 'Chine',
  'costa-rica': 'Costa Rica',
  cyprus: 'Chypre',
  denmark: 'Danemark',
  estonia: 'Estonie',
  finland: 'Finlande',
  georgia: 'Géorgie',
  greece: 'Grèce',
  hungary: 'Hongrie',
  iceland: 'Islande',
  india: 'Inde',
  indonesia: 'Indonésie',
  ireland: 'Irlande',
  israel: 'Israël',
  italy: 'Italie',
  jamaica: 'Jamaïque',
  kazakhstan: 'Kazakhstan',
  kosovo: 'Kosovo',
  latvia: 'Lettonie',
  lithuania: 'Lituanie',
  luxembourg: 'Luxembourg',
  malta: 'Malte',
  moldova: 'Moldavie',
  montenegro: 'Monténégro',
  'new-caledonia': 'Nouvelle-Calédonie',
  nigeria: 'Nigeria',
  'north-macedonia': 'Macédoine du Nord',
  'northern-ireland': 'Irlande du Nord',
  peru: 'Pérou',
  poland: 'Pologne',
  romania: 'Roumanie',
  russia: 'Russie',
  serbia: 'Serbie',
  slovakia: 'Slovaquie',
  slovenia: 'Slovénie',
  ukraine: 'Ukraine',
  venezuela: 'Venezuela',
  wales: 'Pays de Galles',
};

/**
 * Nom français d'une sélection, ou le nom d'origine si inconnu.
 *
 * Le fallback est volontairement silencieux : une sélection non répertoriée
 * s'affiche en anglais plutôt que de faire planter la page.
 */
export function frTeamName(name: string | null | undefined): string {
  if (!name) return '';
  return FR_BY_SLUG[slugify(name)] ?? name;
}
