import { Sparkles, Trophy } from 'lucide-react';
import Link from 'next/link';

export type TeamWCNewsItem = {
  id: number;
  slug: string | null;
  title: string;
  ai_summary: string | null;
  published_at: string | null;
  scraped_at: string;
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Paris',
});

/**
 * Section "Actu Coupe du Monde" pour la page d'une sélection nationale.
 * Affichée seulement quand au moins un article publié existe pour la team.
 */
export function TeamWCNewsSection({
  team_name,
  items,
}: {
  team_name: string;
  items: TeamWCNewsItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="text-primary size-4" aria-hidden />
          <h2 className="text-base font-semibold">Actu Coupe du Monde 2026</h2>
          <span className="text-muted-foreground text-xs">
            — {team_name}
          </span>
        </div>
        <Link
          href="/coupe-du-monde-2026/actu"
          className="text-primary text-xs hover:underline"
        >
          Toutes les news CDM →
        </Link>
      </header>

      <ul className="space-y-3">
        {items.slice(0, 5).map((item) => {
          const href = `/coupe-du-monde-2026/actu/${item.slug ?? item.id}`;
          const date = item.published_at ?? item.scraped_at;
          return (
            <li
              key={item.id}
              className="border-border/60 border-b pb-3 last:border-b-0 last:pb-0"
            >
              <Link
                href={href}
                className="group hover:bg-muted/30 -m-2 block rounded-md p-2 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <Sparkles
                    className="text-primary mt-0.5 size-3 shrink-0"
                    aria-hidden
                  />
                  <p className="text-sm font-semibold leading-snug group-hover:text-primary">
                    {item.title}
                  </p>
                </div>
                {item.ai_summary && (
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                    {item.ai_summary}
                  </p>
                )}
                <p className="text-muted-foreground/70 mt-1.5 text-[10px]">
                  Article Tactuo · {DATE_FMT.format(new Date(date))}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
