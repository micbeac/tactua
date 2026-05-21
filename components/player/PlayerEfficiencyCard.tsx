'use client';

import { motion, useInView } from 'motion/react';
import {
  Activity,
  Crosshair,
  Hand,
  Shield,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useRef } from 'react';
import type { PlayerEfficiency } from '@/lib/data/player-efficiency';

export type PlayerEfficiencyCardProps = {
  efficiency: PlayerEfficiency;
};

function IndexBar({
  label,
  value,
  icon,
  description,
  delay = 0,
  variant = 'primary',
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  description: string;
  delay?: number;
  variant?: 'primary' | 'emerald' | 'amber';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });
  const barColor =
    variant === 'emerald'
      ? 'bg-emerald-400'
      : variant === 'amber'
        ? 'bg-amber-400'
        : 'bg-primary';
  const textColor =
    variant === 'emerald'
      ? 'text-emerald-300'
      : variant === 'amber'
        ? 'text-amber-300'
        : 'text-primary';
  return (
    <div ref={ref} className="border-border bg-card/50 rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase">
          {icon}
          {label}
        </div>
        <span className={`text-lg font-bold tabular-nums ${textColor}`}>
          {value}
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <motion.div
          initial={{ width: 0 }}
          animate={inView ? { width: `${value}%` } : {}}
          transition={{ delay, duration: 0.9, ease: 'easeOut' }}
          className={`h-full ${barColor}`}
        />
      </div>
      <p className="text-muted-foreground/80 mt-2 text-[10px] leading-tight">
        {description}
      </p>
    </div>
  );
}

export function PlayerEfficiencyCard({
  efficiency: e,
}: PlayerEfficiencyCardProps) {
  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-5 flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <TrendingUp className="text-primary size-4" aria-hidden />
          Indices d&apos;efficacité
        </h2>
        <span className="bg-primary/15 text-primary rounded px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
          {e.profile_label}
        </span>
      </header>

      {/* Sommaire chiffré */}
      <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
        <div className="border-border rounded-lg border p-3 text-center">
          <p className="text-primary text-lg font-bold tabular-nums">
            {e.goals_per_match.toFixed(2)}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[10px] tracking-wide uppercase">
            Buts/match
          </p>
        </div>
        <div className="border-border rounded-lg border p-3 text-center">
          <p className="text-primary text-lg font-bold tabular-nums">
            {e.assists_per_match.toFixed(2)}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[10px] tracking-wide uppercase">
            Passes/match
          </p>
        </div>
        <div className="border-border rounded-lg border p-3 text-center">
          <p className="text-primary text-lg font-bold tabular-nums">
            {Math.round(e.minutes_per_match)}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[10px] tracking-wide uppercase">
            Min/match
          </p>
        </div>
        <div className="border-border rounded-lg border p-3 text-center">
          <p className="text-primary text-lg font-bold tabular-nums">
            {e.total_appearances}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[10px] tracking-wide uppercase">
            Titularisations
          </p>
        </div>
      </div>

      {/* 4 indices avec barres */}
      <div className="grid gap-3 sm:grid-cols-2">
        <IndexBar
          label="Productivité"
          value={e.finishing_index}
          icon={<Target className="size-3" aria-hidden />}
          description="Buts + passes par match (1.0/match = 100)"
          delay={0}
          variant="primary"
        />
        <IndexBar
          label="Implication"
          value={e.involvement_index}
          icon={<Activity className="size-3" aria-hidden />}
          description="% minutes jouées sur le total possible"
          delay={0.1}
          variant="emerald"
        />
        <IndexBar
          label="Profil offensif"
          value={e.threat_index}
          icon={<Crosshair className="size-3" aria-hidden />}
          description="100 = pur finisseur · 0 = pur passeur"
          delay={0.2}
          variant="amber"
        />
        <IndexBar
          label="Discipline"
          value={e.discipline_index}
          icon={<Shield className="size-3" aria-hidden />}
          description="Inverse des cartons reçus"
          delay={0.3}
          variant="primary"
        />
      </div>

      <p className="text-muted-foreground/70 mt-4 flex items-start gap-1.5 text-[10px] leading-snug">
        <Hand className="mt-0.5 size-3 shrink-0" aria-hidden />
        <span>
          Indices calculés depuis les stats saison (B, A, minutes, cartons). Pas
          des vrais xG/xA mais utile pour profiler un joueur d&apos;un coup
          d&apos;œil.
        </span>
      </p>
    </section>
  );
}
