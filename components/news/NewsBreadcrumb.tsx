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
};

/**
 * Breadcrumb avec Schema.org BreadcrumbList (signal SEO important pour
 * que Google affiche le fil d'Ariane dans les SERP).
 */
export function NewsBreadcrumb({ crumbs }: Props) {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: crumbs.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.label,
            item: c.href ? `${SITE_URL}${c.href}` : undefined,
          })),
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
