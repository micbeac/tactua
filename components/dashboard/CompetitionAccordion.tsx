'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MatchCard, type MatchCardProps } from '@/components/match/MatchCard';

export type CompetitionAccordionProps = {
  /** Identifiant unique (code compétition) — utilisé comme clé localStorage */
  code: string;
  label: string;
  flag: string;
  matches: MatchCardProps[];
  /** Nombre de matchs total dans la compétition (badge optionnel) */
  upcoming_count?: number;
  /** Ouvert par défaut au premier load (avant lecture localStorage). Default true. */
  default_open?: boolean;
};

const STORAGE_KEY = 'tactuo-dashboard-collapsed';

/**
 * Lit l'état "replié" depuis localStorage, format JSON :
 * { "wc": false, "cl": true, ... } — true = replié
 */
function readCollapsedSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw) as Record<string, boolean>;
    return new Set(Object.entries(data).filter(([, v]) => v).map(([k]) => k));
  } catch {
    return new Set();
  }
}

function writeCollapsed(code: string, collapsed: boolean) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = (raw ? JSON.parse(raw) : {}) as Record<string, boolean>;
    if (collapsed) data[code] = true;
    else delete data[code];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function CompetitionAccordion({
  code,
  label,
  flag,
  matches,
  upcoming_count,
  default_open = true,
}: CompetitionAccordionProps) {
  const [open, setOpen] = useState(default_open);
  const [hydrated, setHydrated] = useState(false);

  // Hydratation depuis localStorage au mount (évite mismatch SSR/CSR)
  useEffect(() => {
    const collapsed = readCollapsedSet();
    setOpen(!collapsed.has(code));
    setHydrated(true);
  }, [code]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (hydrated) writeCollapsed(code, !next);
  }

  const count = upcoming_count ?? matches.length;

  return (
    <section className="mb-3">
      <button
        type="button"
        onClick={toggle}
        className="bg-primary/10 border-primary/20 hover:bg-primary/15 relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition-colors"
        aria-expanded={open}
      >
        {/* Halo subtil */}
        <div className="bg-primary/15 pointer-events-none absolute -top-8 -right-8 size-32 rounded-full blur-2xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="text-xl">
              {flag}
            </span>
            <h2 className="text-base font-semibold sm:text-lg">{label}</h2>
            {count > 0 && (
              <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums">
                {count}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/competitions/${code}`}
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground text-xs underline"
            >
              Voir tout
            </Link>
            <motion.div
              animate={{ rotate: open ? 0 : -90 }}
              transition={{ duration: 0.2 }}
              className="text-muted-foreground"
            >
              <ChevronDown className="size-5" aria-hidden />
            </motion.div>
          </div>
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
              {matches.length === 0 ? (
                <p className="bg-card text-muted-foreground border-border rounded-xl border p-6 text-center text-sm">
                  Aucun match {label} à venir.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {matches.map((m) => (
                    <MatchCard key={m.id} {...m} />
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
