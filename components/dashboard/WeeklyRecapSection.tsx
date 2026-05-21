'use client';

import {
  CalendarRange,
  Goal,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { FavoritePerspective, WeeklyRecap } from '@/lib/data/weekly-recap';

export type WeeklyRecapSectionProps = {
  recap: WeeklyRecap;
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});

function resultBadge(r: 'W' | 'D' | 'L') {
  if (r === 'W')
    return (
      <span className="bg-primary text-primary-foreground inline-flex size-7 items-center justify-center rounded-md text-xs font-bold">
        W
      </span>
    );
  if (r === 'D')
    return (
      <span className="bg-amber-500/30 text-amber-300 inline-flex size-7 items-center justify-center rounded-md text-xs font-bold">
        D
      </span>
    );
  return (
    <span className="bg-destructive/30 text-destructive inline-flex size-7 items-center justify-center rounded-md text-xs font-bold">
      L
    </span>
  );
}

function ResultRow({ p }: { p: FavoritePerspective }) {
  return (
    <Link
      href={`/matches/${p.match_id}`}
      className="bg-card hover:bg-card/80 border-border flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors"
    >
      {resultBadge(p.result)}
      <span className="text-muted-foreground hidden text-[10px] tracking-wide uppercase sm:inline sm:w-24 sm:truncate">
        {p.competition_name ?? '—'}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-semibold">{p.favorite_team.name}</span>
        <span className="text-primary font-bold tabular-nums">{p.goals_for}</span>
        <span className="text-muted-foreground">–</span>
        <span className="text-primary font-bold tabular-nums">
          {p.goals_against}
        </span>
        <span className="text-foreground/80 truncate">{p.opponent.name}</span>
        {!p.was_home && (
          <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
            (ext.)
          </span>
        )}
      </div>
      <span className="text-muted-foreground hidden text-[10px] tabular-nums sm:inline">
        {DATE_FMT.format(new Date(p.date))}
      </span>
    </Link>
  );
}

function TileButton({
  value,
  label,
  color = 'default',
  icon,
  onClick,
  disabled,
}: {
  value: number | string;
  label: string;
  color?: 'default' | 'primary' | 'amber' | 'destructive';
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const valColor =
    color === 'primary'
      ? 'text-primary'
      : color === 'amber'
        ? 'text-amber-400'
        : color === 'destructive'
          ? 'text-destructive'
          : 'text-foreground';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`border-border bg-card relative overflow-hidden rounded-xl border p-4 text-left transition-all ${
        disabled || !onClick
          ? 'cursor-default'
          : 'cursor-pointer hover:bg-card/80 hover:border-primary/40'
      }`}
    >
      <div className="text-muted-foreground/40 absolute top-3 right-3">
        {icon}
      </div>
      <p className={`text-2xl font-bold tabular-nums sm:text-3xl ${valColor}`}>
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{label}</p>
    </button>
  );
}

export function WeeklyRecapSection({ recap }: WeeklyRecapSectionProps) {
  const [showAll, setShowAll] = useState(false);

  if (recap.matches_played === 0) return null;

  const balance = recap.goals_for - recap.goals_against;
  const balanceStr =
    balance > 0 ? `+${balance}` : balance < 0 ? `${balance}` : '0';

  // Forme W/D/L pour les 7 derniers matchs (du + ancien au + récent visuellement)
  const formSeq = [...recap.results].reverse();

  return (
    <section className="bg-primary/10 border-primary/20 relative mb-12 overflow-hidden rounded-2xl border p-5 sm:p-6">
      <div className="bg-primary/20 pointer-events-none absolute -top-16 -right-16 size-64 rounded-full blur-3xl" />
      <div className="bg-emerald-400/10 pointer-events-none absolute -bottom-20 -left-20 size-72 rounded-full blur-3xl" />

      <header className="relative mb-5 flex items-end justify-between">
        <div>
          <p className="text-muted-foreground text-xs tracking-widest uppercase">
            <CalendarRange className="mr-1 inline size-3" aria-hidden />
            Les 7 derniers jours
          </p>
          <h2 className="text-xl font-semibold sm:text-2xl">Ta semaine foot</h2>
        </div>
        <p className="text-muted-foreground text-xs">
          {DATE_FMT.format(new Date(recap.period_start_iso))} →{' '}
          {DATE_FMT.format(new Date(recap.period_end_iso))}
        </p>
      </header>

      {/* Tuiles stats */}
      <div className="relative mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TileButton
          value={recap.matches_played}
          label="matchs joués"
          icon={<CalendarRange className="size-4" aria-hidden />}
          onClick={() => setShowAll(true)}
          disabled={recap.matches_played === 0}
        />
        <TileButton
          value={`${recap.wins}V-${recap.draws}N-${recap.losses}D`}
          label="bilan"
          color={
            recap.wins > recap.losses
              ? 'primary'
              : recap.wins < recap.losses
                ? 'destructive'
                : 'amber'
          }
          icon={<Trophy className="size-4" aria-hidden />}
        />
        <TileButton
          value={`${recap.goals_for}–${recap.goals_against}`}
          label={`buts (diff ${balanceStr})`}
          color={balance > 0 ? 'primary' : balance < 0 ? 'destructive' : 'amber'}
          icon={<Goal className="size-4" aria-hidden />}
        />
        <TileButton
          value={`${Math.round(((recap.wins * 3 + recap.draws) / (recap.matches_played * 3)) * 100)}%`}
          label="points cumulés"
          icon={<ShieldAlert className="size-4" aria-hidden />}
        />
      </div>

      {/* Forme W/D/L visuelle */}
      {formSeq.length > 0 && (
        <div className="relative mb-5">
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Forme de la semaine (du + ancien au + récent)
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {formSeq.map((p) => (
              <Link
                key={p.match_id + '-' + p.favorite_team.id}
                href={`/matches/${p.match_id}`}
                title={`${p.favorite_team.name} ${p.goals_for}-${p.goals_against} ${p.opponent.name}`}
                className="transition-transform hover:scale-110"
              >
                {resultBadge(p.result)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Best / Worst result */}
      {(recap.best_result || recap.worst_result) && (
        <div className="relative grid gap-3 sm:grid-cols-2">
          {recap.best_result && (
            <div className="bg-primary/5 border-primary/30 rounded-lg border p-3">
              <p className="text-primary mb-1.5 flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase">
                <ThumbsUp className="size-3" aria-hidden />
                Meilleur résultat
              </p>
              <Link
                href={`/matches/${recap.best_result.match_id}`}
                className="text-sm hover:underline"
              >
                <span className="font-semibold">
                  {recap.best_result.favorite_team.name}
                </span>{' '}
                <span className="text-primary font-bold tabular-nums">
                  {recap.best_result.goals_for}
                </span>
                <span className="text-muted-foreground mx-1">–</span>
                <span className="text-primary font-bold tabular-nums">
                  {recap.best_result.goals_against}
                </span>{' '}
                <span className="text-foreground/80">
                  {recap.best_result.opponent.name}
                </span>
              </Link>
            </div>
          )}
          {recap.worst_result && (
            <div className="bg-destructive/5 border-destructive/30 rounded-lg border p-3">
              <p className="text-destructive mb-1.5 flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase">
                <ThumbsDown className="size-3" aria-hidden />
                Plus dure défaite
              </p>
              <Link
                href={`/matches/${recap.worst_result.match_id}`}
                className="text-sm hover:underline"
              >
                <span className="font-semibold">
                  {recap.worst_result.favorite_team.name}
                </span>{' '}
                <span className="text-destructive font-bold tabular-nums">
                  {recap.worst_result.goals_for}
                </span>
                <span className="text-muted-foreground mx-1">–</span>
                <span className="text-destructive font-bold tabular-nums">
                  {recap.worst_result.goals_against}
                </span>{' '}
                <span className="text-foreground/80">
                  {recap.worst_result.opponent.name}
                </span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Popup tous les résultats */}
      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="bg-card border-border max-w-2xl border sm:max-w-2xl">
          <DialogTitle className="mb-3 text-base font-semibold">
            Tous les résultats de la semaine ({recap.results.length})
          </DialogTitle>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <ul className="space-y-1.5">
              {recap.results.map((p) => (
                <li key={p.match_id + '-' + p.favorite_team.id}>
                  <ResultRow p={p} />
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
