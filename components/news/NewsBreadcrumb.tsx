import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { JsonLd } from '@/components/seo/JsonLd';
import { SITE_URL } from '@/lib/site';

type Crumb = {
  label: string;
  href?: string;
};

type Props = {
  crumbs: Crumb[];
  /** URL canonique de la page courante (pour le dernier item du JSON-LD). */
  current_url?: string;
};

/**
 * Breadcrumb avec Schema.org BreadcrumbList (signal SEO important pour
 * que Google affiche le fil d'Ariane dans les SERP).
 *
 * Important : depuis fin 2025 Google rejette les entrées sans champ `item`.
 * On garantit donc une URL pour chaque ListItem (href fourni, current_url
 * pour la page courante, ou SITE_URL en dernier recours).
 */
export function NewsBreadcrumb({ crumbs, current_url }: Props) {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            const item = c.href
              ? `${SITE_URL}${c.href}`
              : isLast
                ? (current_url ?? SITE_URL)
                : SITE_URL;
            return {
              '@type': 'ListItem',
              position: i + 1,
              name: c.label,
              item,
            };
          }),
        }}
      />
      <nav
        aria-label="Fil d'ariane"
        className="text-muted-foreground mb-4 flex flex-wrap items-center gap-1 text-xs"
      >
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={i} className="flex items-center gap-1">
              {c.href && !isLast ? (
                <Link href={c.href} className="hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span className={isLast ? 'text-foreground' : ''}>
                  {c.label}
                </span>
              )}
              {!isLast && <ChevronRight className="size-3" aria-hidden />}
            </span>
          );
        })}
      </nav>
    </>
  );
}
