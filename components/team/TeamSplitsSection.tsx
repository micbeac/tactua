'use client';

import { motion, useInView } from 'motion/react';
import {
  Activity,
  ArrowDown,
  Clock,
  Home,
  Plane,
  Trophy,
} from 'lucide-react';
import { useRef } from 'react';
import type { TeamSplits } from '@/lib/data/team-splits';

export type TeamSplitsSectionProps = {
  splits: TeamSplits;
  team_name: string;
};

function pctBar(value: number, max: number): number {
  if (max === 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

function LocationCard({
  variant,
  label,
  icon,
  data,
}: {
  variant: 'home' | 'away';
  label: string;
  icon: React.ReactNode;
  data: TeamSplits['home'];
}) {
  if (data.matches_played === 0) {
    return (
      <div className="border-border bg-card rounded-xl border p-4">
        <div className="text-muted-foreground mb-3 flex items-center gap-2 text-xs tracking-wide uppercase">
          {icon}
          {label}
        </div>
        <p className="text-muted-foreground py-2 text-center text-xs italic">
          Aucun match enregistré
        </p>
      </div>
    );
  }
  const winRate = (data.wins / data.matches_played) * 100;
  const goalsForPerMatch = data.goals_for / data.matches_played;
  const goalsAgainstPerMatch = data.goals_against / data.matches_played;
  const accent = variant === 'home' ? 'border-primary/30 bg-primary/5' : 'border-border bg-card';
  return (
    <div className={`rounded-xl border p-4 ${accent}`}>
      <div className="text-muted-foreground mb-3 flex items-center gap-2 text-xs tracking-wide uppercase">
        {icon}
        {label}
      </div>
      <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
        Bilan
      </p>
      <p className="mb-2 text-lg font-bold tabular-nums">
        <span className="text-primary">{data.wins}</span>
        <span className="text-muted-foreground mx-1 font-normal">V</span>
        <span className="text-amber-400">{data.draws}</span>
        <span className="text-muted-foreground mx-1 font-normal">N</span>
        <span className="text-destructive">{data.losses}</span>
        <span className="text-muted-foreground mx-1 font-normal">D</span>
      </p>
      <p className="text-muted-foreground mb-3 text-[10px]">
        sur {data.matches_played} matchs · {Math.round(winRate)}% victoires
      </p>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Buts marqués / match</span>
          <span className="text-primary font-bold tabular-nums">
            {goalsForPerMatch.toFixed(2)}
          </span>
        </div>
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full"
            style={{ width: `${pctBar(goalsForPerMatch, 4)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Buts encaissés / match</span>
          <span className="text-destructive font-bold tabular-nums">
            {goalsAgainstPerMatch.toFixed(2)}
          </span>
        </div>
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-destructive h-full"
            style={{ width: `${pctBar(goalsAgainstPerMatch, 4)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function HalfBar({
  label,
  forGoals,
  againstGoals,
  matchesPlayed,
  delay = 0,
}: {
  label: string;
  forGoals: number;
  againstGoals: number;
  matchesPlayed: number;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });
  if (matchesPlayed === 0) return null;
  const total = Math.max(forGoals + againstGoals, 1);
  const forPct = (forGoals / total) * 100;
  return (
    <div ref={ref}>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-semibold tracking-wide uppercase text-[10px]">
          {label}
        </span>
        <span className="text-muted-foreground tabular-nums">
          <span className="text-primary font-bold">{forGoals}</span>
          <span className="mx-1">–</span>
          <span className="text-destructive font-bold">{againstGoals}</span>
        </span>
      </div>
      <div className="bg-destructive/30 relative flex h-3 overflow-hidden rounded-full">
        <motion.div
          initial={{ width: 0 }}
          animate={inView ? { width: `${forPct}%` } : {}}
          transition={{ delay, duration: 0.8, ease: 'easeOut' }}
          className="bg-primary h-full"
        />
      </div>
    </div>
  );
}

export function TeamSplitsSection({
  splits,
  team_name,
}: TeamSplitsSectionProps) {
  const totalPlayed =
    splits.home.matches_played + splits.away.matches_played;
  if (totalPlayed === 0) return null;

  const hasHalfData =
    splits.first_half.matches_played > 0 ||
    splits.second_half.matches_played > 0;

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-5 flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Activity className="text-primary size-4" aria-hidden />
          Stats par tranche
          <span className="text-muted-foreground text-xs font-normal">
            · {team_name}
          </span>
        </h2>
        <p className="text-muted-foreground text-xs tabular-nums">
          {totalPlayed} matchs
        </p>
      </header>

      {/* Domicile vs Extérieur */}
      <div className="mb-6">
        <p className="text-muted-foreground mb-3 flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase">
          <Trophy className="size-3" aria-hidden />À domicile vs à l&apos;extérieur
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <LocationCard
            variant="home"
            label="À domicile"
            icon={<Home className="size-3.5" aria-hidden />}
            data={splits.home}
          />
          <LocationCard
            variant="away"
            label="À l'extérieur"
            icon={<Plane className="size-3.5" aria-hidden />}
            data={splits.away}
          />
        </div>
      </div>

      {/* Mi-temps */}
      {hasHalfData && (
        <div>
          <p className="text-muted-foreground mb-3 flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase">
            <Clock className="size-3" aria-hidden />
            Performance par mi-temps
            <span className="text-muted-foreground/60 ml-1 font-normal">
              ({splits.first_half.matches_played} matchs)
            </span>
          </p>
          <div className="space-y-4">
            <HalfBar
              label="1ère mi-temps"
              forGoals={splits.first_half.goals_for}
              againstGoals={splits.first_half.goals_against}
              matchesPlayed={splits.first_half.matches_played}
              delay={0}
            />
            <HalfBar
              label="2e mi-temps"
              forGoals={splits.second_half.goals_for}
              againstGoals={splits.second_half.goals_against}
              matchesPlayed={splits.second_half.matches_played}
              delay={0.15}
            />
          </div>
          <p className="text-muted-foreground/70 mt-3 flex items-center gap-1 text-[10px]">
            <ArrowDown className="size-3" aria-hidden />
            Vert = buts marqués · Rouge = buts encaissés
          </p>
        </div>
      )}
    </section>
  );
}
