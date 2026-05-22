'use client';

import { motion } from 'motion/react';
import { Calendar, Clock, Sparkles, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
// URL directe `/matches/[id]` (pas de slug pour les matchs)
const matchHref = (id: number) => `/matches/${id}`;

type Team = {
  id: number | null;
  name: string;
  tla: string | null;
  logo_url: string | null;
};

export type WatchlistMatch = {
  id: number;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  stage: string | null;
  matchday: number | null;
  score_home: number | null;
  score_away: number | null;
  competition_name: string | null;
  home: Team;
  away: Team;
};

export type WatchlistSectionProps = {
  matches: WatchlistMatch[];
};

const SHORT_DATE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Paris',
});

const TIME_FMT = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

/**
 * Calcule un libellé de countdown lisible jusqu'au kickoff.
 * Exemples : "Dans 5j 12h", "Dans 1j 3h", "Dans 4h 17min", "Dans 23min",
 *            "C'est l'heure !", "Hier" pour le passé.
 */
function computeCountdown(kickoffIso: string, status: string): {
  label: string;
  urgent: boolean;
  imminent: boolean;
  past: boolean;
} {
  if (status === 'live') {
    return { label: 'EN DIRECT', urgent: true, imminent: false, past: false };
  }
  if (status === 'finished') {
    return { label: 'Terminé', urgent: false, imminent: false, past: true };
  }
  const diff = new Date(kickoffIso).getTime() - Date.now();
  if (diff <= 0) {
    return {
      label: "C'est l'heure !",
      urgent: true,
      imminent: true,
      past: false,
    };
  }
  const min = Math.floor(diff / 60000);
  const hours = Math.floor(min / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainHours = hours - days * 24;
    return {
      label: remainHours > 0 ? `Dans ${days}j ${remainHours}h` : `Dans ${days}j`,
      urgent: false,
      imminent: days <= 1,
      past: false,
    };
  }
  if (hours > 0) {
    const remainMin = min - hours * 60;
    return {
      label: remainMin > 0 ? `Dans ${hours}h ${remainMin}min` : `Dans ${hours}h`,
      urgent: hours < 3,
      imminent: true,
      past: false,
    };
  }
  return {
    label: `Dans ${min}min`,
    urgent: true,
    imminent: true,
    past: false,
  };
}

function TeamLogo({ team }: { team: Team }) {
  return (
    <div className="bg-muted/50 relative size-9 shrink-0 overflow-hidden rounded-full">
      {team.logo_url ? (
        <Image
          src={team.logo_url}
          alt=""
          fill
          sizes="36px"
          className="object-contain p-1"
        />
      ) : (
        <span className="text-muted-foreground flex h-full w-full items-center justify-center text-[10px] font-semibold">
          {team.tla ?? '?'}
        </span>
      )}
    </div>
  );
}

function WatchlistCard({ match }: { match: WatchlistMatch }) {
  // Re-render le countdown toutes les 30 secondes (suffisant pour la lisibilité)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);
  // tick force le recompute
  void tick;

  const cd = computeCountdown(match.kickoff_at, match.status);
  const kickoff = new Date(match.kickoff_at);
  const date = SHORT_DATE.format(kickoff);
  const time = TIME_FMT.format(kickoff);

  const borderClass = cd.urgent
    ? 'border-primary/50 bg-primary/5'
    : cd.imminent
      ? 'border-primary/30 bg-card'
      : 'border-border bg-card';

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`rounded-xl border p-4 transition-all ${borderClass}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-muted-foreground flex items-center gap-1.5 text-[10px] tracking-wide uppercase">
          <Calendar className="size-3" aria-hidden />
          {match.competition_name ?? '—'}
          {match.matchday != null && ` · J${match.matchday}`}
        </p>
        <div
          className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
            cd.urgent
              ? 'bg-primary text-primary-foreground'
              : cd.imminent
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          <Clock className="size-3" aria-hidden />
          {cd.label}
        </div>
      </div>

      <Link
        href={matchHref(match.id)}
        className="hover:bg-muted/30 -mx-2 mb-3 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors"
      >
        <TeamLogo team={match.home} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{match.home.name}</p>
        </div>
        <span className="text-muted-foreground text-xs">vs</span>
        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-sm font-semibold">{match.away.name}</p>
        </div>
        <TeamLogo team={match.away} />
      </Link>

      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span className="tabular-nums">
          {date} · {time}
        </span>
        <Link href={`${matchHref(match.id)}#analyse`}>
          <Button size="sm" variant={cd.imminent ? 'default' : 'outline'}>
            <Sparkles className="mr-1 size-3.5" aria-hidden />
            {cd.past ? "Voir l'analyse" : 'Analyser'}
          </Button>
        </Link>
      </div>
    </motion.article>
  );
}

export function WatchlistSection({ matches }: WatchlistSectionProps) {
  if (matches.length === 0) return null;

  return (
    <section className="mb-12">
      <header className="mb-4 flex items-end justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Star className="text-primary size-5" aria-hidden />
          Ta watchlist
          <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums">
            {matches.length}
          </span>
        </h2>
        <Link
          href="/favoris"
          className="text-muted-foreground hover:text-foreground text-xs underline"
        >
          Gérer mes favoris
        </Link>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {matches.map((m) => (
          <WatchlistCard key={m.id} match={m} />
        ))}
      </div>
    </section>
  );
}
