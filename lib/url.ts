// URL helpers : slug + id pour les fiches équipe et joueur.
// Format : `paris-saint-germain-524`, `kylian-mbappe-44`.
// L'id est toujours en suffixe (utilisé pour la query DB), le slug est cosmétique
// pour le SEO et la lisibilité.

export function slugify(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // supprime les marques de combinaison (accents)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function teamHref(id: number, name: string | null | undefined): string {
  const slug = slugify(name);
  return slug ? `/teams/${slug}-${id}` : `/teams/${id}`;
}

export function playerHref(
  id: number,
  name: string | null | undefined,
): string {
  const slug = slugify(name);
  return slug ? `/players/${slug}-${id}` : `/players/${id}`;
}

/**
 * Extrait l'id numérique d'un slug du type `paris-saint-germain-524`.
 * Tolère les anciens formats purement numériques (`524`).
 * Retourne null si rien d'utilisable.
 */
export function parseEntityId(slug: string): number | null {
  const m = slug.match(/(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Vérifie si le slug fourni correspond à la forme canonique attendue.
 * Sinon, on émet un 301 vers la canonique pour éviter le contenu dupliqué.
 */
export function isCanonicalSlug(
  slug: string,
  expectedHref: string,
  base: '/teams' | '/players',
): boolean {
  return `${base}/${slug}` === expectedHref;
}
