import {
  CalendarDays,
  ExternalLink,
  Newspaper,
  Star,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import type { DailyRecap } from '@/lib/data/recap';

export type DailyRecapSectionProps = {
  recap: DailyRecap;
  /** Prénom ou email — utilisé pour personnaliser le titre */
  user_label?: string | null;
};

const DAY_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function StatTile({
  value,
  label,
  highlight,
  icon,
}: {
  value: number | string;
  label: string;
  highlight?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`border-border bg-card relative overflow-hidden rounded-xl border p-4 ${
        highlight ? 'ring-primary/30 ring-2' : ''
      }`}
    >
      <div
        className={`absolute top-3 right-3 ${
          highlight ? 'text-primary' : 'text-muted-foreground/40'
        }`}
      >
        {icon}
      </div>
      <p
        className={`text-2xl font-bold tabular-nums sm:text-3xl ${
          highlight ? 'text-primary' : 'text-foreground'
        }`}
      >
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{label}</p>
    </div>
  );
}

export function DailyRecapSection({
  recap,
  user_label,
}: DailyRecapSectionProps) {
  const today = DAY_FMT.format(new Date());
  // On rend la capitale de la première lettre du jour
  const todayLabel = today.charAt(0).toUpperCase() + today.slice(1);
  const greeting = user_label
    ? `Ton foot du jour, ${user_label}`
    : 'Ton foot du jour';

  // Si l'utilisateur n'a aucune activité et qu'on n'a rien à dire, on cache la section.
  const hasContent =
    recap.matches_today_total > 0 ||
    recap.favorite_results_yesterday.length > 0 ||
    recap.latest_favorite_narratives.length > 0;
  if (!hasContent) return null;

  return (
    <section className="bg-primary/10 border-primary/20 relative mb-12 overflow-hidden rounded-2xl border p-5 sm:p-6">
      {/* Halos décoratifs (cohérent avec les autres headers) */}
      <div className="bg-primary/20 pointer-events-none absolute -top-16 -right-16 size-64 rounded-full blur-3xl" />
      <div className="bg-emerald-400/10 pointer-events-none absolute -bottom-20 -left-20 size-72 rounded-full blur-3xl" />

      <header className="relative mb-5">
        <p className="text-muted-foreground text-xs tracking-widest uppercase">
          {todayLabel}
        </p>
        <h2 className="text-xl font-semibold sm:text-2xl">{greeting}</h2>
      </header>

      {/* Tuiles statistiques */}
      <div className="relative mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          value={recap.matches_today_total}
          label="matchs trackés aujourd'hui"
          icon={<CalendarDays className="size-4" aria-hidden />}
        />
        <StatTile
          value={recap.matches_today_favorites}
          label="dont favoris"
          highlight={recap.matches_today_favorites > 0}
          icon={<Star className="size-4" aria-hidden />}
        />
        <StatTile
          value={recap.favorite_results_yesterday.length}
          label="résultats favoris hier"
          icon={<Trophy className="size-4" aria-hidden />}
        />
        <StatTile
          value={recap.latest_favorite_narratives.length}
          label="news fraîches favoris"
          icon={<Newspaper className="size-4" aria-hidden />}
        />
      </div>

      {/* Résultats d'hier */}
      {recap.favorite_results_yesterday.length > 0 && (
        <div className="relative mb-5">
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            <Trophy className="mr-1 inline size-3" aria-hidden />
            Hier — résultats des favoris
          </h3>
          <ul className="space-y-1.5">
            {recap.favorite_results_yesterday.slice(0, 5).map((r) => (
              <li key={r.match_id}>
                <Link
                  href={`/matches/${r.match_id}`}
                  className="bg-card hover:bg-card/80 border-border flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors"
                >
                  <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                    {r.competition_name ?? '—'}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <span className="text-foreground/80">
                      {r.home.tla ?? r.home.name}
                    </span>
                    <span className="text-primary font-bold tabular-nums">
                      {r.score_home}
                    </span>
                    <span className="text-muted-foreground">–</span>
                    <span className="text-primary font-bold tabular-nums">
                      {r.score_away}
                    </span>
                    <span className="text-foreground/80">
                      {r.away.tla ?? r.away.name}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* News fraîches */}
      {recap.latest_favorite_narratives.length > 0 && (
        <div className="relative">
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            <Newspaper className="mr-1 inline size-3" aria-hidden />À chaud sur tes équipes
          </h3>
          <ul className="space-y-1.5">
            {recap.latest_favorite_narratives.slice(0, 4).map((n, i) => {
              const Tag = n.url ? 'a' : 'div';
              return (
                <li key={i}>
                  <Tag
                    href={n.url ?? undefined}
                    target={n.url ? '_blank' : undefined}
                    rel={n.url ? 'noopener noreferrer' : undefined}
                    className="bg-card hover:bg-card/80 border-border group flex items-start gap-3 rounded-lg border px-3 py-2 text-sm transition-colors"
                  >
                    <span className="bg-primary/15 text-primary mt-0.5 shrink-0 rounded px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                      {n.team_name}
                    </span>
                    <p className="line-clamp-2 flex-1">{n.title}</p>
                    {n.url && (
                      <ExternalLink
                        className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                        aria-hidden
                      />
                    )}
                  </Tag>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
