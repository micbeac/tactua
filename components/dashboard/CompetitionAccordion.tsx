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
  /**
   * Lien "Voir tout". `undefined` → /competitions/[code] (défaut).
   * `null` → masque le lien (ex : accordéons par stage CDM).
   */
  view_all_href?: string | null;
  /** Texte affiché quand il n'y a aucun match. */
  empty_label?: string;
};

const STORAGE_KEY = 'tactuo-dashboard-state';

/**
 * Stocke l'état explicite de l'utilisateur : `'open' | 'closed'` pour chaque code.
 * Si un code n'a jamais été cliqué, il est absent du store et on retombe
 * sur `default_open`. Cette stratégie est plus prévisible que de stocker
 * uniquement les replis.
 */
function readStoredState(code: string): 'open' | 'closed' | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, 'open' | 'closed'>;
    return data[code] ?? null;
  } catch {
    return null;
  }
}

function writeState(code: string, state: 'open' | 'closed') {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = (raw ? JSON.parse(raw) : {}) as Record<
      string,
      'open' | 'closed'
    >;
    data[code] = state;
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
  view_all_href,
  empty_label,
}: CompetitionAccordionProps) {
  const viewAllHref =
    view_all_href === undefined ? `/competitions/${code}` : view_all_href;
  const [open, setOpen] = useState(default_open);
  const [hydrated, setHydrated] = useState(false);

  // Hydratation depuis localStorage au mount (évite mismatch SSR/CSR)
  useEffect(() => {
    const stored = readStoredState(code);
    if (stored != null) setOpen(stored === 'open');
    setHydrated(true);
  }, [code]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (hydrated) writeState(code, next ? 'open' : 'closed');
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
            {viewAllHref && (
              <Link
                href={viewAllHref}
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-foreground text-xs underline"
              >
                Voir tout
              </Link>
            )}
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
                  {empty_label ?? `Aucun match ${label} à venir.`}
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
