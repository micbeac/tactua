import {
  AlertOctagon,
  ArrowRightLeft,
  Goal,
  Square,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import { playerHref } from '@/lib/url';

export type LiveMatchEvent = {
  id: number;
  minute: number | null;
  extra_minute: number | null;
  type: string;     // 'goal' | 'card' | 'subst' | 'var'
  detail: string | null;
  comments: string | null;
  team_id: number | null;
  team_side: 'home' | 'away' | null;
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
};

type Props = {
  events: LiveMatchEvent[];
  home_team_name: string;
  away_team_name: string;
  match_status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
};

function formatMinute(m: LiveMatchEvent): string {
  if (m.minute == null) return '—';
  if (m.extra_minute) return `${m.minute}+${m.extra_minute}'`;
  return `${m.minute}'`;
}

function eventIcon(type: string, detail: string | null) {
  if (type === 'goal') {
    if (detail?.toLowerCase().includes('own')) {
      return <Goal className="text-rose-400 size-4" aria-hidden />;
    }
    if (detail?.toLowerCase().includes('penalty')) {
      return <Goal className="text-amber-300 size-4" aria-hidden />;
    }
    return <Goal className="text-primary size-4" aria-hidden />;
  }
  if (type === 'card') {
    if (detail?.toLowerCase().includes('red')) {
      return <Square className="size-4 fill-rose-500 text-rose-500" aria-hidden />;
    }
    return <Square className="size-4 fill-amber-400 text-amber-400" aria-hidden />;
  }
  if (type === 'subst') {
    return <ArrowRightLeft className="text-muted-foreground size-4" aria-hidden />;
  }
  if (type === 'var') {
    return <AlertOctagon className="text-amber-400 size-4" aria-hidden />;
  }
  return <Trophy className="text-muted-foreground size-4" aria-hidden />;
}

function PlayerName({
  player,
  fallback,
}: {
  player: { id: number | null; name: string | null };
  fallback?: string;
}) {
  const name = player.name ?? fallback ?? '';
  if (!name) return null;
  if (player.id != null) {
    return (
      <Link
        href={playerHref(player.id, name)}
        className="hover:text-primary hover:underline"
      >
        {name}
      </Link>
    );
  }
  return <span>{name}</span>;
}

function eventLabel(e: LiveMatchEvent): React.ReactNode {
  const detail = (e.detail ?? '').toLowerCase();
  if (e.type === 'goal') {
    if (detail.includes('own')) {
      return (
        <>
          <span className="font-semibold">CSC</span> ·{' '}
          <PlayerName player={e.player} fallback="?" />
        </>
      );
    }
    if (detail.includes('penalty')) {
      return (
        <>
          <span className="font-semibold">But (pen)</span> ·{' '}
          <PlayerName player={e.player} fallback="?" />
        </>
      );
    }
    return (
      <>
        <span className="font-semibold">But</span> ·{' '}
        <PlayerName player={e.player} fallback="?" />
        {e.assist.name && (
          <>
            {' '}
            <span className="text-muted-foreground text-xs">
              (passe : <PlayerName player={e.assist} fallback={e.assist.name} />)
            </span>
          </>
        )}
      </>
    );
  }
  if (e.type === 'card') {
    const color = detail.includes('red') ? 'rouge' : 'jaune';
    return (
      <>
        <span className="font-semibold">Carton {color}</span> ·{' '}
        <PlayerName player={e.player} fallback="?" />
      </>
    );
  }
  if (e.type === 'subst') {
    return (
      <>
        <span className="font-semibold">Changement</span> · {' '}
        <PlayerName player={e.assist} fallback={e.assist.name ?? '?'} /> ↑{' '}
        <PlayerName player={e.player} fallback={e.player.name ?? '?'} /> ↓
      </>
    );
  }
  if (e.type === 'var') {
    return (
      <>
        <span className="font-semibold">VAR</span> ·{' '}
        <span className="text-muted-foreground text-xs">
          {e.detail ?? e.comments ?? ''}
        </span>
      </>
    );
  }
  return <span>{e.detail ?? e.type}</span>;
}

export function LiveEventTimeline({
  events,
  home_team_name,
  away_team_name,
  match_status,
}: Props) {
  if (events.length === 0) {
    if (match_status === 'live' || match_status === 'finished') {
      return (
        <section className="bg-card border-border rounded-2xl border p-6">
          <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
            Timeline
          </h2>
          <p className="text-muted-foreground py-2 text-center text-xs italic">
            Pas d&apos;événement enregistré pour le moment.
          </p>
        </section>
      );
    }
    return null;
  }

  // Tri par minute décroissante (le + récent en premier — comme un fil live)
  const sorted = events.slice().sort((a, b) => {
    const am = (a.minute ?? 0) * 100 + (a.extra_minute ?? 0);
    const bm = (b.minute ?? 0) * 100 + (b.extra_minute ?? 0);
    return bm - am;
  });

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Timeline</h2>
        {match_status === 'live' && (
          <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
            <span className="bg-primary inline-block size-1.5 animate-pulse rounded-full" />
            En direct
          </span>
        )}
      </header>

      <ol className="relative">
        {sorted.map((e, i) => {
          const isHome = e.team_side === 'home';
          const teamLabel =
            e.team_side === 'home'
              ? home_team_name
              : e.team_side === 'away'
                ? away_team_name
                : null;
          return (
            <li
              key={e.id || i}
              className="border-border/40 flex items-start gap-3 border-b py-2.5 text-sm last:border-b-0"
            >
              <div className="text-muted-foreground w-12 shrink-0 text-right text-xs font-mono tabular-nums">
                {formatMinute(e)}
              </div>
              <div className="mt-0.5 shrink-0">{eventIcon(e.type, e.detail)}</div>
              <div className="min-w-0 flex-1">
                {teamLabel && (
                  <p
                    className={`text-[10px] uppercase tracking-wide ${isHome ? 'text-primary' : 'text-emerald-400'}`}
                  >
                    {teamLabel}
                  </p>
                )}
                <p className="text-sm leading-snug">{eventLabel(e)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
