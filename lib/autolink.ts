// Auto-linker pour le contenu IA des news. Remplace les occurrences de
// noms d'équipes / joueurs / matchs par des liens internes vers leurs
// fiches Tactuo. Améliore le maillage SEO et la qualité de lecture.
//
// Stratégie :
//   1. On reçoit une liste d'entités { type, name, href }
//   2. On trie par longueur décroissante (les noms les plus longs en
//      premier — évite que "Lautaro" capte avant "Lautaro Martínez")
//   3. Pour chaque entité, on cherche dans le HTML les occurrences
//      EN DEHORS des tags existants (regex avec négation simple)
//   4. On remplace la 1re occurrence seulement (évite la sur-densité
//      de liens, mauvais signal SEO)

export type LinkableEntity = {
  type: 'team' | 'player' | 'match';
  name: string;
  href: string;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Applique les liens internes sur un HTML déjà rendu (string).
 * Modifie uniquement le texte hors balises.
 *
 * @param html HTML produit par renderMarkdown
 * @param entities Liste des noms à transformer en liens
 * @returns HTML enrichi
 */
export function autolinkHtml(
  html: string,
  entities: LinkableEntity[],
): string {
  if (entities.length === 0) return html;

  // Tri : noms les plus longs en premier (évite "Lautaro" qui capte
  // dans "Lautaro Martínez")
  const sorted = entities.slice().sort((a, b) => b.name.length - a.name.length);

  // On découpe le HTML en segments (texte vs tags) pour ne remplacer
  // que dans les segments de texte. Approche simple : on split sur les balises.
  const parts = html.split(/(<[^>]+>)/);

  // Suit les noms déjà linkés au moins une fois pour ne pas sur-lier
  const alreadyLinked = new Set<string>();

  for (let i = 0; i < parts.length; i++) {
    let segment = parts[i]!;
    // Skip si c'est une balise
    if (segment.startsWith('<')) continue;

    for (const entity of sorted) {
      if (alreadyLinked.has(entity.name)) continue;
      // \b ne marche pas bien avec les accents, on utilise un look-around
      // simulé avec un wrapper de boundaries autorisées
      const pattern = new RegExp(
        `(^|[\\s«»"',;.!?:()\\-])(${escapeRegExp(entity.name)})($|[\\s«»"',;.!?:()\\-])`,
      );
      const match = segment.match(pattern);
      if (match) {
        const linkClass =
          entity.type === 'player'
            ? 'text-primary hover:underline font-medium'
            : entity.type === 'team'
              ? 'text-primary hover:underline font-medium'
              : 'text-primary hover:underline';
        const replacement = `${match[1]}<a href="${entity.href}" class="${linkClass}" data-autolink="${entity.type}">${match[2]}</a>${match[3]}`;
        segment = segment.replace(pattern, replacement);
        alreadyLinked.add(entity.name);
      }
    }
    parts[i] = segment;
  }

  return parts.join('');
}
