import { ExternalLink, Newspaper } from 'lucide-react';

export type TeamNarrativeItem = {
  title: string;
  url: string | null;
  snippet: string | null;
  scraped_at: string;
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});

export function TeamNarrativesSection({
  team_name,
  items,
}: {
  team_name: string;
  items: TeamNarrativeItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-4 flex items-center gap-2">
        <Newspaper className="text-primary size-4" aria-hidden />
        <h2 className="text-base font-semibold">Actu récente</h2>
        <span className="text-muted-foreground text-xs">— {team_name}</span>
      </header>

      <ul className="space-y-3">
        {items.slice(0, 5).map((item, i) => {
          const inner = (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold leading-snug">
                  {item.title}
                </p>
                {item.url && (
                  <ExternalLink
                    className="text-muted-foreground size-3.5 shrink-0 transition-colors group-hover:text-foreground"
                    aria-hidden
                  />
                )}
              </div>
              {item.snippet && (
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                  {item.snippet}
                </p>
              )}
              <p className="text-muted-foreground/70 mt-1.5 text-[10px]">
                Actualisé le {DATE_FMT.format(new Date(item.scraped_at))}
              </p>
            </>
          );
          return (
            <li
              key={i}
              className="border-border/60 border-b pb-3 last:border-b-0 last:pb-0"
            >
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
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
