'use client';

import {
  CalendarClock,
  ExternalLink,
  Sparkles,
  Trophy,
  UserPlus,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { PlayerPopup } from '@/components/match/PlayerPopup';
import type { FeedItem } from '@/lib/data/for-you-feed';

export type ForYouFeedSectionProps = {
  items: FeedItem[];
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
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

type TileId = 'matches' | 'results' | 'players';

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

function UpcomingMatchRow({
  item,
}: {
  item: Extract<FeedItem, { type: 'upcoming_match' }>;
}) {
  const m = item.match;
  return (
    <Link
      href={`/matches/${m.id}#analyse`}
      className="bg-card hover:bg-card/80 border-border block rounded-lg border px-3 py-2.5 transition-colors"
    >
      <div className="text-muted-foreground mb-1 flex items-center justify-between text-[10px] tracking-wide uppercase">
        <span className="flex items-center gap-1">
          <CalendarClock className="size-3" aria-hidden />
          {m.competition?.name ?? '—'}
        </span>
        <span className="text-primary tabular-nums">
          {DATE_FMT.format(new Date(m.kickoff_at))}
        </span>
      </div>
      <p className="text-sm font-semibold">
        {m.home_team?.name ?? 'À déterminer'}
        <span className="text-muted-foreground mx-2 text-xs">vs</span>
        {m.away_team?.name ?? 'À déterminer'}
      </p>
    </Link>
  );
}

function ResultRow({
  item,
}: {
  item: Extract<FeedItem, { type: 'recent_result' }>;
}) {
  const r = item.result;
  const isWin = r.result === 'W';
  const isLoss = r.result === 'L';
  const accent = isWin
    ? 'border-primary/30 bg-primary/5'
    : isLoss
      ? 'border-destructive/30 bg-destructive/5'
      : 'border-border bg-card';
  return (
    <Link
      href={`/matches/${r.match_id}`}
      className={`block rounded-lg border px-3 py-2.5 transition-colors hover:opacity-80 ${accent}`}
    >
      <div className="text-muted-foreground mb-1 flex items-center justify-between text-[10px] tracking-wide uppercase">
        <span className="flex items-center gap-1">
          <Trophy className="size-3" aria-hidden />
          {r.competition_name ?? '—'}
        </span>
        <span className="tabular-nums">
          {SHORT_DATE.format(new Date(r.date))}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate font-semibold">{r.favorite_team.name}</span>
        <span className="text-primary font-bold tabular-nums">
          {r.goals_for}
        </span>
        <span className="text-muted-foreground">–</span>
        <span className="text-primary font-bold tabular-nums">
          {r.goals_against}
        </span>
        <span className="text-foreground/80 truncate">{r.opponent.name}</span>
      </div>
    </Link>
  );
}

function PlayerRow({
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
      <div className="bg-card hover:bg-card/80 border-border flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors">
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
        <div className="text-right text-[10px] tracking-wide uppercase">
          <p className="text-primary font-bold tabular-nums">
            {p.goals}b · {p.assists}a
          </p>
        </div>
      </div>
    </PlayerPopup>
  );
}

export function ForYouFeedSection({ items }: ForYouFeedSectionProps) {
  const [activeTile, setActiveTile] = useState<TileId | null>(null);

  // Catégorise les items par type
  const upcomingMatches = items.filter(
    (i): i is Extract<FeedItem, { type: 'upcoming_match' }> =>
      i.type === 'upcoming_match',
  );
  const recentResults = items.filter(
    (i): i is Extract<FeedItem, { type: 'recent_result' }> =>
      i.type === 'recent_result',
  );
  const playerRecos = items.filter(
    (i): i is Extract<FeedItem, { type: 'player_reco' }> =>
      i.type === 'player_reco',
  );

  // Top suggestion à mettre en avant comme highlight de tuile
  const topUpcoming = upcomingMatches[0] ?? null;

  const totalContent =
    upcomingMatches.length + recentResults.length + playerRecos.length;
  if (totalContent === 0) return null;

  const dialogTitles: Record<TileId, string> = {
    matches: `${upcomingMatches.length} matchs imminents`,
    results: `${recentResults.length} résultats récents`,
    players: `${playerRecos.length} suggestions joueurs`,
  };

  return (
    <section className="mb-12">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="text-primary size-5" aria-hidden />
          Pour toi
        </h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Clique sur une tuile pour voir le détail
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <TileButton
          value={upcomingMatches.length}
          label="matchs imminents"
          highlight={Boolean(topUpcoming)}
          icon={<CalendarClock className="size-4" aria-hidden />}
          onClick={() => setActiveTile('matches')}
          disabled={upcomingMatches.length === 0}
        />
        <TileButton
          value={recentResults.length}
          label="résultats récents"
          icon={<Trophy className="size-4" aria-hidden />}
          onClick={() => setActiveTile('results')}
          disabled={recentResults.length === 0}
        />
        <TileButton
          value={playerRecos.length}
          label="suggestions joueurs"
          icon={<UserPlus className="size-4" aria-hidden />}
          onClick={() => setActiveTile('players')}
          disabled={playerRecos.length === 0}
        />
      </div>

      <Dialog
        open={activeTile !== null}
        onOpenChange={(o) => !o && setActiveTile(null)}
      >
        <DialogContent className="bg-card border-border max-w-2xl border sm:max-w-2xl">
          <DialogTitle className="mb-3 text-base font-semibold">
            {activeTile && dialogTitles[activeTile]}
          </DialogTitle>

          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {activeTile === 'matches' && (
              <ul className="space-y-2">
                {upcomingMatches.map((it) => (
                  <li key={it.key}>
                    <UpcomingMatchRow item={it} />
                  </li>
                ))}
              </ul>
            )}

            {activeTile === 'results' && (
              <ul className="space-y-2">
                {recentResults.map((it) => (
                  <li key={it.key}>
                    <ResultRow item={it} />
                  </li>
                ))}
              </ul>
            )}

            {activeTile === 'players' && (
              <ul className="space-y-2">
                {playerRecos.map((it) => (
                  <li key={it.key}>
                    <PlayerRow item={it} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
