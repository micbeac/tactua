'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MatchCard } from '@/components/match/MatchCard';
import type { DayMatchGroup } from '@/lib/matchday';

type Props = {
  /** Jour initial (YYYY-MM-DD, Paris) rendu côté serveur */
  initial_date: string;
  /** Groupes du jour initial, rendus côté serveur */
  initial_groups: DayMatchGroup[];
  /** Aujourd'hui (YYYY-MM-DD Paris) — pour les libellés relatifs */
  today: string;
};

const STORAGE_KEY = 'tactuo-dashboard-state';
const ACCORDION_CODE = 'matchs-du-jour';
const LIVE_REFRESH_MS = 45_000;

const DATE_LABEL_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Paris',
});

function readStored(): 'open' | 'closed' | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, 'open' | 'closed'>;
    return data[ACCORDION_CODE] ?? null;
  } catch {
    return null;
  }
}

function writeStored(state: 'open' | 'closed') {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = (raw ? JSON.parse(raw) : {}) as Record<
      string,
      'open' | 'closed'
    >;
    data[ACCORDION_CODE] = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function shiftDay(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function dayLabel(ymd: string, today: string): string {
  if (ymd === today) return "Aujourd'hui";
  if (ymd === shiftDay(today, 1)) return 'Demain';
  if (ymd === shiftDay(today, -1)) return 'Hier';
  const label = DATE_LABEL_FMT.format(new Date(`${ymd}T12:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function MatchesOfDaySection({
  initial_date,
  initial_groups,
  today,
}: Props) {
  const [open, setOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [date, setDate] = useState(initial_date);
  const [groups, setGroups] = useState<DayMatchGroup[]>(initial_groups);
  const [loading, setLoading] = useState(false);

  // Hydratation localStorage (état accordéon)
  useEffect(() => {
    const stored = readStored();
    if (stored != null) setOpen(stored === 'open');
    setHydrated(true);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (hydrated) writeStored(next ? 'open' : 'closed');
  }

  const fetchDay = useCallback(async (ymd: string, withSpinner: boolean) => {
    if (withSpinner) setLoading(true);
    try {
      const res = await fetch(`/api/matches/by-day?date=${ymd}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        date: string;
        groups: DayMatchGroup[];
      };
      // Ignore les réponses obsolètes (l'utilisateur a changé de jour entretemps)
      setDate((current) => {
        if (json.date === current) setGroups(json.groups);
        return current;
      });
    } catch {
      // silencieux
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, []);

  // Changement de jour → fetch (sauf le jour initial déjà rendu côté serveur)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void fetchDay(date, true);
  }, [date, fetchDay]);

  // Auto-refresh des scores si au moins un match est en live
  const hasLive = groups.some((g) =>
    g.matches.some((m) => m.status === 'live'),
  );
  useEffect(() => {
    if (!hasLive) return;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        void fetchDay(date, false);
      }
    };
    const id = setInterval(tick, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [hasLive, date, fetchDay]);

  const totalMatches = groups.reduce((s, g) => s + g.matches.length, 0);

  return (
    <section className="mb-3">
      <button
        type="button"
        onClick={toggle}
        className="bg-primary/10 border-primary/20 hover:bg-primary/15 relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition-colors"
        aria-expanded={open}
      >
        <div className="bg-primary/15 pointer-events-none absolute -top-8 -right-8 size-32 rounded-full blur-2xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="text-xl">
              📅
            </span>
            <h2 className="text-base font-semibold sm:text-lg">
              Matchs du jour
            </h2>
            {totalMatches > 0 && (
              <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums">
                {totalMatches}
              </span>
            )}
            {hasLive && (
              <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                <span className="bg-primary size-1.5 animate-pulse rounded-full" />
                Live
              </span>
            )}
          </div>
          <motion.div
            animate={{ rotate: open ? 0 : -90 }}
            transition={{ duration: 0.2 }}
            className="text-muted-foreground"
          >
            <ChevronDown className="size-5" aria-hidden />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              {/* Navigation jour */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setDate((d) => shiftDay(d, -1))}
                  className="bg-card hover:border-primary/40 border-border inline-flex size-9 items-center justify-center rounded-lg border transition-colors"
                  aria-label="Jour précédent"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {dayLabel(date, today)}
                  {loading && (
                    <span className="bg-primary/60 size-1.5 animate-pulse rounded-full" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDate((d) => shiftDay(d, 1))}
                  className="bg-card hover:border-primary/40 border-border inline-flex size-9 items-center justify-center rounded-lg border transition-colors"
                  aria-label="Jour suivant"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>

              {/* Liste groupée par compétition */}
              {groups.length === 0 ? (
                <p className="bg-card text-muted-foreground border-border rounded-xl border p-6 text-center text-sm">
                  Aucun match programmé ce jour-là sur les compétitions
                  trackées.
                </p>
              ) : (
                <div className="space-y-5">
                  {groups.map((g) => (
                    <div key={g.code}>
                      <header className="mb-2 flex items-center gap-2">
                        <span className="text-base" aria-hidden>
                          {g.flag}
                        </span>
                        <h3 className="text-sm font-semibold">{g.name}</h3>
                        <span className="bg-primary/15 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                          {g.matches.length}
                        </span>
                      </header>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {g.matches.map((m) => (
                          <MatchCard key={m.id} {...m} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
