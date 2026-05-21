'use client';

import { motion } from 'motion/react';
import {
  CalendarClock,
  ExternalLink,
  Newspaper,
  Sparkles,
  Trophy,
  UserPlus,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { PlayerPopup } from '@/components/match/PlayerPopup';
import type { FeedItem } from '@/lib/data/for-you-feed';

export type ForYouFeedSectionProps = {
  items: FeedItem[];
};

const DAY_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const SHORT_DATE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const absMin = Math.abs(diff) / (1000 * 60);
  const isPast = diff < 0;
  if (absMin < 60)
    return isPast ? `Il y a ${Math.round(absMin)}min` : `Dans ${Math.round(absMin)}min`;
  const absHours = absMin / 60;
  if (absHours < 24)
    return isPast
      ? `Il y a ${Math.round(absHours)}h`
      : `Dans ${Math.round(absHours)}h`;
  const absDays = absHours / 24;
  if (absDays < 7)
    return isPast
      ? `Il y a ${Math.round(absDays)}j`
      : `Dans ${Math.round(absDays)}j`;
  return SHORT_DATE.format(new Date(iso));
}

function TeamMini({
  name,
  logo_url,
}: {
  name: string;
  logo_url: string | null;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {logo_url && (
        <div className="bg-muted/50 relative size-5 shrink-0 overflow-hidden rounded-full">
          <Image
            src={logo_url}
            alt=""
            fill
            sizes="20px"
            className="object-contain p-0.5"
            unoptimized
          />
        </div>
      )}
      <span className="truncate text-sm font-medium">{name}</span>
    </div>
  );
}

function UpcomingMatchCard({
  item,
}: {
  item: Extract<FeedItem, { type: 'upcoming_match' }>;
}) {
  const m = item.match;
  const home = {
    name: m.home_team?.name ?? 'À déterminer',
    logo_url: m.home_team?.logo_url ?? null,
  };
  const away = {
    name: m.away_team?.name ?? 'À déterminer',
    logo_url: m.away_team?.logo_url ?? null,
  };
  return (
    <Link
      href={`/matches/${m.id}#analyse`}
      className="bg-card hover:border-primary/40 border-border block rounded-xl border p-3 transition-all hover:shadow-md"
    >
      <div className="text-muted-foreground mb-2 flex items-center justify-between text-[10px] tracking-wide uppercase">
        <span className="flex items-center gap-1">
          <CalendarClock className="size-3" aria-hidden />À venir ·{' '}
          {m.competition?.name ?? '—'}
        </span>
        <span className="text-primary">{relativeTime(m.kickoff_at)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <TeamMini name={home.name} logo_url={home.logo_url} />
        <span className="text-muted-foreground text-xs">vs</span>
        <TeamMini name={away.name} logo_url={away.logo_url} />
      </div>
      <p className="text-muted-foreground mt-2 text-[10px] tabular-nums">
        {DAY_FMT.format(new Date(m.kickoff_at))}
      </p>
    </Link>
  );
}

function RecentResultCard({
  item,
}: {
  item: Extract<FeedItem, { type: 'recent_result' }>;
}) {
  const r = item.result;
  const isWin = r.result === 'W';
  const isLoss = r.result === 'L';
  const accent = isWin
    ? 'bg-primary/5 border-primary/30'
    : isLoss
      ? 'bg-destructive/5 border-destructive/30'
      : 'bg-card border-border';
  const resultLabel = isWin ? 'Victoire' : isLoss ? 'Défaite' : 'Match nul';
  return (
    <Link
      href={`/matches/${r.match_id}`}
      className={`block rounded-xl border p-3 transition-all hover:shadow-md ${accent}`}
    >
      <div className="text-muted-foreground mb-2 flex items-center justify-between text-[10px] tracking-wide uppercase">
        <span className="flex items-center gap-1">
          <Trophy className="size-3" aria-hidden />
          {resultLabel} · {r.competition_name ?? '—'}
        </span>
        <span>{relativeTime(r.date)}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate font-semibold">{r.favorite_team.name}</span>
        <span className="text-primary mx-1 font-bold tabular-nums">
          {r.goals_for}
        </span>
        <span className="text-muted-foreground">–</span>
        <span className="text-primary mx-1 font-bold tabular-nums">
          {r.goals_against}
        </span>
        <span className="text-foreground/80 truncate">{r.opponent.name}</span>
      </div>
    </Link>
  );
}

function NewsCard({
  item,
}: {
  item: Extract<FeedItem, { type: 'news' }>;
}) {
  const n = item.news;
  const Tag = n.url ? 'a' : 'div';
  return (
    <Tag
      href={n.url ?? undefined}
      target={n.url ? '_blank' : undefined}
      rel={n.url ? 'noopener noreferrer' : undefined}
      className="bg-card hover:border-primary/40 border-border group block rounded-xl border p-3 transition-all hover:shadow-md"
    >
      <div className="text-muted-foreground mb-2 flex items-center justify-between text-[10px] tracking-wide uppercase">
        <span className="flex items-center gap-1">
          <Newspaper className="size-3" aria-hidden />
          Actu ·{' '}
          <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[10px] font-bold">
            {n.team_name}
          </span>
        </span>
        <span>{relativeTime(n.scraped_at)}</span>
      </div>
      <div className="flex items-start gap-2">
        <p className="line-clamp-2 flex-1 text-sm font-medium">{n.title}</p>
        {n.url && (
          <ExternalLink
            className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
            aria-hidden
          />
        )}
      </div>
    </Tag>
  );
}

function PlayerRecoCard({
  item,
}: {
  item: Extract<FeedItem, { type: 'player_reco' }>;
}) {
  const p = item.player;
  return (
    <PlayerPopup
      player={{
        name: p.name,
        photo: p.photo_url,
        position: p.position,
        shirt_number: p.shirt_number,
        db_player_id: p.player_id,
        appearances: p.appearances,
        goals: p.goals,
        assists: p.assists,
      }}
      team_name={p.team_name}
    >
      <div className="bg-card hover:border-primary/40 border-border block cursor-pointer rounded-xl border p-3 transition-all hover:shadow-md">
        <div className="text-muted-foreground mb-2 flex items-center justify-between text-[10px] tracking-wide uppercase">
          <span className="flex items-center gap-1">
            <UserPlus className="size-3" aria-hidden />
            Suggestion
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="border-primary/30 bg-muted relative size-10 shrink-0 overflow-hidden rounded-full border">
            {p.photo_url ? (
              <Image
                src={p.photo_url}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="text-muted-foreground flex h-full w-full items-center justify-center text-xs font-bold">
                {p.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{p.name}</p>
            <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
              {p.reason}
            </p>
          </div>
          <div className="text-muted-foreground text-right text-[10px] tracking-wide uppercase">
            <p className="text-primary font-bold tabular-nums">
              {p.goals}b · {p.assists}a
            </p>
          </div>
        </div>
      </div>
    </PlayerPopup>
  );
}

export function ForYouFeedSection({ items }: ForYouFeedSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="mb-12">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="text-primary size-5" aria-hidden />
          Pour toi
        </h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Le mix personnalisé : matchs imminents, résultats, actu et
          suggestions
        </p>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {items.map((item, i) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.3 }}
          >
            {item.type === 'upcoming_match' && (
              <UpcomingMatchCard item={item} />
            )}
            {item.type === 'recent_result' && <RecentResultCard item={item} />}
            {item.type === 'news' && <NewsCard item={item} />}
            {item.type === 'player_reco' && <PlayerRecoCard item={item} />}
          </motion.div>
        ))}
      </div>
    </section>
  );
}
