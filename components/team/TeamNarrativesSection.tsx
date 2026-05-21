import { ExternalLink, Newspaper, Sparkles } from 'lucide-react';
import Link from 'next/link';

export type TeamNarrativeItem = {
  title: string;
  url: string | null;
  snippet: string | null;
  scraped_at: string;
  /** Slug interne /news/[slug] si l'IA a généré une page dédiée */
  internal_slug?: string | null;
  /** Résumé IA prioritaire sur snippet */
  ai_summary?: string | null;
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});

export function TeamNarrativesSection({
  team_name,
  team_slug,
  items,
}: {
  team_name: string;
  /** URL slug de l'équipe pour le lien "Toutes les news" → /teams/[slug]/actu */
  team_slug?: string;
  items: TeamNarrativeItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Newspaper className="text-primary size-4" aria-hidden />
          <h2 className="text-base font-semibold">Actu récente</h2>
          <span className="text-muted-foreground text-xs">— {team_name}</span>
        </div>
        {team_slug && (
          <Link
            href={`/teams/${team_slug}/actu`}
            className="text-primary text-xs hover:underline"
          >
            Toutes les news →
          </Link>
        )}
      </header>

      <ul className="space-y-3">
        {items.slice(0, 5).map((item, i) => {
          const internalHref = item.internal_slug
            ? `/news/${item.internal_slug}`
            : null;
          const summary = item.ai_summary ?? item.snippet;
          const inner = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  {internalHref && (
                    <Sparkles
                      className="text-primary mt-0.5 size-3 shrink-0"
                      aria-hidden
                    />
                  )}
                  <p className="text-sm font-semibold leading-snug">
                    {item.title}
                  </p>
                </div>
                {!internalHref && item.url && (
                  <ExternalLink
                    className="text-muted-foreground size-3.5 shrink-0 transition-colors group-hover:text-foreground"
                    aria-hidden
                  />
                )}
              </div>
              {summary && (
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                  {summary}
                </p>
              )}
              <p className="text-muted-foreground/70 mt-1.5 text-[10px]">
                {internalHref ? 'Analyse Tactuo · ' : ''}
                Actualisé le {DATE_FMT.format(new Date(item.scraped_at))}
              </p>
            </>
          );
          return (
            <li
              key={i}
              className="border-border/60 border-b pb-3 last:border-b-0 last:pb-0"
            >
              {internalHref ? (
                <Link
                  href={internalHref}
                  className="group hover:bg-muted/30 -m-2 block rounded-md p-2 transition-colors"
                >
                  {inner}
                </Link>
              ) : item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="group hover:bg-muted/30 -m-2 block rounded-md p-2 transition-colors"
                >
                  {inner}
                </a>
              ) : (
                <div className="group">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
