'use client';

import { useEffect, useState } from 'react';

// Kickoff officiel CDM 2026 : 11 juin 2026, 19h00 UTC (~21h Paris).
const KICKOFF_ISO = '2026-06-11T19:00:00Z';

type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  is_live: boolean;
};

function computeRemaining(): Remaining {
  const target = new Date(KICKOFF_ISO).getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, is_live: true };
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  return { days, hours, minutes, is_live: false };
}

function Cell({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="bg-card border-border min-w-[3.5rem] rounded-lg border px-3 py-2 text-2xl font-semibold tabular-nums sm:min-w-[4rem] sm:text-3xl">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-muted-foreground mt-1 text-[10px] tracking-wide uppercase">
        {label}
      </span>
    </div>
  );
}

export function WorldCupCountdown() {
  // SSR-safe : on initialise une fois côté client puis on rafraîchit chaque minute.
  const [r, setR] = useState<Remaining | null>(null);

  useEffect(() => {
    // Init immédiate au mount client (SSR rend le placeholder à 0).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setR(computeRemaining());
    const id = setInterval(() => setR(computeRemaining()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!r) {
    // placeholder pendant le SSR pour éviter le décalage
    return (
      <div className="flex gap-2 sm:gap-3" aria-hidden>
        <Cell value={0} label="jours" />
        <Cell value={0} label="heures" />
        <Cell value={0} label="min" />
      </div>
    );
  }

  if (r.is_live) {
    return (
      <p className="text-primary inline-flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
        <span className="bg-primary inline-block size-2 animate-pulse rounded-full" />
        La Coupe du Monde est lancée
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-2 sm:gap-3">
        <Cell value={r.days} label="jours" />
        <Cell value={r.hours} label="heures" />
        <Cell value={r.minutes} label="min" />
      </div>
      <p className="text-muted-foreground hidden text-xs sm:block">
        avant le coup d&apos;envoi
      </p>
    </div>
  );
}
