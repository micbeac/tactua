'use client';

import {
  CalendarDays,
  ExternalLink,
  Newspaper,
  Star,
  Trophy,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { DailyRecap, RecapMatchListItem } from '@/lib/data/recap';

export type DailyRecapSectionProps = {
  recap: DailyRecap;
  user_label?: string | null;
};

const DAY_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const TIME_FMT = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

type TileId = 'today' | 'favorites' | 'yesterday' | 'news';

function TileButton({
  value,
  label,
  highlight,
  icon,
  onClick,
  disabled,
}: {
  value: number | string;
  label: string;
  highlight?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`border-border bg-card relative overflow-hidden rounded-xl border p-4 text-left transition-all ${
        highlight ? 'ring-primary/30 ring-2' : ''
      } ${
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'hover:bg-card/80 hover:border-primary/40 hover:shadow-lg cursor-pointer'
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
    </button>
  );
}

function MatchListRow({ match }: { match: RecapMatchListItem }) {
  const time = TIME_FMT.format(new Date(match.kickoff_at));
  return (
    <Link
      href={`/matches/${match.match_id}`}
      className="bg-card hover:bg-card/80 border-border flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors"
    >
      <span className="text-muted-foreground w-10 shrink-0 text-[10px] tabular-nums">
        {time}
      </span>
      {match.is_favorite && (
        <Star className="text-primary size-3.5 shrink-0" aria-hidden />
      )}
      <span className="text-muted-foreground hidden text-[10px] tracking-wide uppercase sm:inline sm:w-28 sm:truncate">
        {match.competition_name ?? '—'}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {match.home.logo_url && (
          <div className="bg-muted/50 relative size-5 shrink-0 overflow-hidden rounded-full">
            <Image
              src={match.home.logo_url}
              alt=""
              fill
              sizes="20px"
              className="object-contain p-0.5"
            />
          </div>
        )}
        <span className="truncate text-sm font-medium">{match.home.name}</span>
        <span className="text-muted-foreground text-xs">vs</span>
        <span className="truncate text-sm font-medium">{match.away.name}</span>
        {match.away.logo_url && (
          <div className="bg-muted/50 relative size-5 shrink-0 overflow-hidden rounded-full">
            <Image
              src={match.away.logo_url}
              alt=""
              fill
              sizes="20px"
              className="object-contain p-0.5"
            />
          </div>
        )}
      </div>
      {match.status === 'live' && (
        <span className="bg-primary text-primary-foreground rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
          Live
        </span>
      )}
    </Link>
  );
}

export function DailyRecapSection({
  recap,
  user_label,
}: DailyRecapSectionProps) {
  const today = DAY_FMT.format(new Date());
  const todayLabel = today.charAt(0).toUpperCase() + today.slice(1);
  const greeting = user_label
    ? `Ton foot du jour, ${user_label}`
    : 'Ton foot du jour';

  const [activeTile, setActiveTile] = useState<TileId | null>(null);

  const hasContent =
    recap.matches_today.length > 0 ||
    recap.favorite_results_yesterday.length > 0 ||
    recap.latest_favorite_narratives.length > 0;
  if (!hasContent) return null;

  const dialogTitle: Record<TileId, string> = {
    today: `${recap.matches_today.length} matchs trackés aujourd'hui`,
    favorites: `${recap.matches_today_favorites.length} matchs favoris aujourd'hui`,
    yesterday: `${recap.favorite_results_yesterday.length} résultats des favoris hier`,
    news: `${recap.latest_favorite_narratives.length} news fraîches`,
  };

  return (
    <section className="bg-primary/10 border-primary/20 relative mb-12 overflow-hidden rounded-2xl border p-5 sm:p-6">
      <div className="bg-primary/20 pointer-events-none absolute -top-16 -right-16 size-64 rounded-full blur-3xl" />
      <div className="bg-emerald-400/10 pointer-events-none absolute -bottom-20 -left-20 size-72 rounded-full blur-3xl" />

      <header className="relative mb-5">
        <p className="text-muted-foreground text-xs tracking-widest uppercase">
          {todayLabel}
        </p>
        <h2 className="text-xl font-semibold sm:text-2xl">{greeting}</h2>
        <p className="text-muted-foreground/80 mt-1 text-xs">
          Clique sur une tuile pour voir le détail
        </p>
      </header>

      {/* Tuiles cliquables */}
      <div className="relative mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TileButton
          value={recap.matches_today.length}
          label="matchs trackés aujourd'hui"
          icon={<CalendarDays className="size-4" aria-hidden />}
          onClick={() => setActiveTile('today')}
          disabled={recap.matches_today.length === 0}
        />
        <TileButton
          value={recap.matches_today_favorites.length}
          label="dont favoris"
          highlight={recap.matches_today_favorites.length > 0}
          icon={<Star className="size-4" aria-hidden />}
          onClick={() => setActiveTile('favorites')}
          disabled={recap.matches_today_favorites.length === 0}
        />
        <TileButton
          value={recap.favorite_results_yesterday.length}
          label="résultats favoris hier"
          icon={<Trophy className="size-4" aria-hidden />}
          onClick={() => setActiveTile('yesterday')}
          disabled={recap.favorite_results_yesterday.length === 0}
        />
        <TileButton
          value={recap.latest_favorite_narratives.length}
          label="news fraîches favoris"
          icon={<Newspaper className="size-4" aria-hidden />}
          onClick={() => setActiveTile('news')}
          disabled={recap.latest_favorite_narratives.length === 0}
        />
      </div>

      {/* Résultats d'hier (visible en bas) */}
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

      {/* News fraîches (visible en bas) */}
      {recap.latest_favorite_narratives.length > 0 && (
        <div className="relative">
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            <Newspaper className="mr-1 inline size-3" aria-hidden />À chaud sur tes équipes
          </h3>
          <ul className="space-y-1.5">
            {recap.latest_favorite_narratives.slice(0, 4).map((n, i) => {
              // Priorité au lien interne /news/[slug] si dispo (contenu IA),
              // sinon lien externe vers la source originale.
              const internalHref = n.internal_slug
                ? `/news/${n.internal_slug}`
                : null;
              const href = internalHref ?? n.url ?? null;
              const isExternal = !internalHref && n.url;
              return (
                <li key={i}>
                  {href ? (
                    <a
                      href={href}
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noopener noreferrer' : undefined}
                      className="bg-card hover:bg-card/80 border-border group flex items-start gap-3 rounded-lg border px-3 py-2 text-sm transition-colors"
                    >
                      <span className="bg-primary/15 text-primary mt-0.5 shrink-0 rounded px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                        {n.team_name}
                      </span>
                      <p className="line-clamp-2 flex-1">{n.title}</p>
                      {isExternal && (
                        <ExternalLink
                          className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                          aria-hidden
                        />
                      )}
                    </a>
                  ) : (
                    <div className="bg-card border-border flex items-start gap-3 rounded-lg border px-3 py-2 text-sm">
                      <span className="bg-primary/15 text-primary mt-0.5 shrink-0 rounded px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                        {n.team_name}
                      </span>
                      <p className="line-clamp-2 flex-1">{n.title}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* === Popups détaillés === */}
      <Dialog
        open={activeTile !== null}
        onOpenChange={(o) => !o && setActiveTile(null)}
      >
        <DialogContent className="bg-card border-border max-w-2xl border sm:max-w-2xl">
          <DialogTitle className="mb-3 text-base font-semibold">
            {activeTile && dialogTitle[activeTile]}
          </DialogTitle>

          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {activeTile === 'today' && (
              <ul className="space-y-1.5">
                {recap.matches_today.map((m) => (
                  <li key={m.match_id}>
                    <MatchListRow match={m} />
                  </li>
                ))}
              </ul>
            )}

            {activeTile === 'favorites' && (
              <ul className="space-y-1.5">
                {recap.matches_today_favorites.map((m) => (
                  <li key={m.match_id}>
                    <MatchListRow match={m} />
                  </li>
                ))}
              </ul>
            )}

            {activeTile === 'yesterday' && (
              <ul className="space-y-1.5">
                {recap.favorite_results_yesterday.map((r) => (
                  <li key={r.match_id}>
                    <Link
                      href={`/matches/${r.match_id}`}
                      className="bg-muted/30 hover:bg-muted/50 border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors"
                    >
                      <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                        {r.competition_name ?? '—'}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-foreground/80">
                          {r.home.name}
                        </span>
                        <span className="text-primary font-bold tabular-nums">
                          {r.score_home}
                        </span>
                        <span className="text-muted-foreground">–</span>
                        <span className="text-primary font-bold tabular-nums">
                          {r.score_away}
                        </span>
                        <span className="text-foreground/80">
                          {r.away.name}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {activeTile === 'news' && (
              <ul className="space-y-2">
                {recap.latest_favorite_narratives.map((n, i) => {
                  const Tag = n.url ? 'a' : 'div';
                  return (
                    <li key={i}>
                      <Tag
                        href={n.url ?? undefined}
                        target={n.url ? '_blank' : undefined}
                        rel={n.url ? 'noopener noreferrer' : undefined}
                        className="bg-muted/30 hover:bg-muted/50 border-border group flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors"
                      >
                        <span className="bg-primary/15 text-primary mt-0.5 shrink-0 rounded px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                          {n.team_name}
                        </span>
                        <p className="flex-1">{n.title}</p>
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
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
