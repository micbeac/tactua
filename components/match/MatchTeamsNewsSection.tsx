import { Newspaper, Sparkles } from 'lucide-react';
import Link from 'next/link';

export type MatchNewsItem = {
  id: number;
  title: string;
  slug: string | null;
  ai_summary: string | null;
  scraped_at: string;
  has_ai_content: boolean;
};

type Props = {
  home: {
    id: number;
    name: string;
    slug: string;
    items: MatchNewsItem[];
  } | null;
  away: {
    id: number;
    name: string;
    slug: string;
    items: MatchNewsItem[];
  } | null;
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});

function NewsColumn({
  team_name,
  team_slug,
  items,
}: {
  team_name: string;
  team_slug: string;
  items: MatchNewsItem[];
}) {
  if (items.length === 0) {
    return (
      <div className="border-border rounded-lg border p-4">
        <p className="text-primary mb-2 text-[10px] font-semibold tracking-widest uppercase">
          {team_name}
        </p>
        <p className="text-muted-foreground text-xs italic">
          Pas d&apos;actualité récente.
        </p>
      </div>
    );
  }

  return (
    <div className="border-border rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-primary text-[10px] font-semibold tracking-widest uppercase truncate">
          {team_name}
        </p>
        <Link
          href={`/teams/${team_slug}/actu`}
          className="text-muted-foreground hover:text-foreground shrink-0 text-[10px] hover:underline"
        >
          Toutes →
        </Link>
      </div>
      <ul className="space-y-2">
        {items.slice(0, 3).map((n) => {
          const href = n.slug ? `/news/${n.slug}` : null;
          const inner = (
            <>
              <div className="flex items-start gap-2">
                {n.has_ai_content && (
                  <Sparkles
                    className="text-primary mt-0.5 size-3 shrink-0"
                    aria-hidden
                  />
                )}
                <p className="line-clamp-2 text-xs font-semibold leading-snug">
                  {n.title}
                </p>
              </div>
              {n.ai_summary && (
                <p className="text-muted-foreground mt-1 line-clamp-2 text-[11px]">
                  {n.ai_summary}
                </p>
              )}
              <p className="text-muted-foreground/70 mt-1.5 text-[10px]">
                {DATE_FMT.format(new Date(n.scraped_at))}
              </p>
            </>
          );
          return (
            <li
              key={n.id}
              className="border-border/40 border-b pb-2 last:border-b-0 last:pb-0"
            >
              {href ? (
                <Link
                  href={href}
                  className="hover:bg-muted/30 -mx-1.5 block rounded px-1.5 py-1 transition-colors"
                >
                  {inner}
                </Link>
              ) : (
                <div>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MatchTeamsNewsSection({ home, away }: Props) {
  // N'affiche pas la section si aucune des deux équipes n'a de news
  const hasAnyNews =
    (home && home.items.length > 0) || (away && away.items.length > 0);
  if (!hasAnyNews) return null;

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-4 flex items-center gap-2">
        <Newspaper className="text-primary size-4" aria-hidden />
        <h2 className="text-base font-semibold">Actu récente des deux clubs</h2>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {home && (
          <NewsColumn
            team_name={home.name}
            team_slug={home.slug}
            items={home.items}
          />
        )}
        {away && (
          <NewsColumn
            team_name={away.name}
            team_slug={away.slug}
            items={away.items}
          />
        )}
      </div>
    </section>
  );
}
