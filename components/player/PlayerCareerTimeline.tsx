'use client';

import { motion } from 'motion/react';
import { ArrowRight, Clock } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

export type CareerTransfer = {
  date: string;
  type: string | null; // ex "€ 23M", "Free", "Loan"
  from_team: string;
  from_team_logo: string | null;
  to_team: string;
  to_team_logo: string | null;
};

export type PlayerCareerTimelineProps = {
  transfers: CareerTransfer[];
  /** Club actuel à mettre en bout de timeline (highlight) */
  current_team?: {
    name: string;
    logo_url: string | null;
  } | null;
};

const YEAR_FMT = new Intl.DateTimeFormat('fr-FR', { year: 'numeric' });
const FULL_DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function ClubBadge({
  name,
  logo,
  size = 32,
}: {
  name: string;
  logo: string | null;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="bg-muted/40 border-border relative shrink-0 overflow-hidden rounded-full border"
        style={{ width: size, height: size }}
      >
        {logo ? (
          <Image
            src={logo}
            alt=""
            fill
            sizes={`${size}px`}
            className="object-contain p-0.5"
            unoptimized
          />
        ) : (
          <span className="text-muted-foreground flex h-full w-full items-center justify-center text-[10px] font-semibold">
            {name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <span className="truncate text-sm font-medium">{name}</span>
    </div>
  );
}

function TypeBadge({ type }: { type: string | null }) {
  if (!type)
    return (
      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
        Transfert
      </span>
    );
  const isFree = /free|libre/i.test(type);
  const isLoan = /loan|prêt|pret/i.test(type);
  if (isFree) {
    return (
      <span className="bg-emerald-500/15 text-emerald-300 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
        Libre
      </span>
    );
  }
  if (isLoan) {
    return (
      <span className="bg-blue-500/15 text-blue-300 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
        Prêt
      </span>
    );
  }
  // Montant ex "€ 23M"
  return (
    <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide tabular-nums">
      {type}
    </span>
  );
}

export function PlayerCareerTimeline({
  transfers,
  current_team,
}: PlayerCareerTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  // Tri du + ancien au + récent (transferts_json est déjà trié mais on s'assure)
  const sorted = [...transfers].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0 && !current_team) return null;

  const VISIBLE_COUNT = 5;
  const shouldCollapse = sorted.length > VISIBLE_COUNT;
  const displayed =
    shouldCollapse && !expanded
      ? sorted.slice(-VISIBLE_COUNT)
      : sorted;

  // Année min / max pour la barre de progression
  const firstYear = sorted.length > 0 ? new Date(sorted[0].date).getFullYear() : null;
  const lastYear = new Date().getFullYear();

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-5 flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Clock className="text-primary size-4" aria-hidden />
          Carrière
          {firstYear && (
            <span className="text-muted-foreground text-xs font-normal">
              · {firstYear} → {lastYear}
            </span>
          )}
        </h2>
        {sorted.length > 0 && (
          <p className="text-muted-foreground text-xs tabular-nums">
            {sorted.length} transfert{sorted.length > 1 ? 's' : ''}
          </p>
        )}
      </header>

      {sorted.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          Aucun transfert enregistré pour le moment.
        </p>
      ) : (
        <>
          {shouldCollapse && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-muted-foreground hover:text-foreground mb-3 text-xs underline"
            >
              + Voir les {sorted.length - VISIBLE_COUNT} transferts précédents
            </button>
          )}

          {/* Timeline verticale */}
          <ol className="relative space-y-4 border-l-2 border-primary/20 pl-6">
            {displayed.map((t, i) => {
              const date = new Date(t.date);
              const year = YEAR_FMT.format(date);
              return (
                <motion.li
                  key={i + '-' + t.date}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.35 }}
                  className="relative"
                >
                  {/* Pastille sur la timeline */}
                  <span
                    className="bg-primary border-card absolute -left-[31px] flex size-5 items-center justify-center rounded-full border-2"
                    aria-hidden
                  >
                    <span className="bg-card size-1.5 rounded-full" />
                  </span>

                  <div className="bg-muted/30 border-border rounded-xl border p-3.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-primary text-sm font-bold tabular-nums">
                          {year}
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          {FULL_DATE_FMT.format(date)}
                        </span>
                      </div>
                      <TypeBadge type={t.type} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <ClubBadge name={t.from_team} logo={t.from_team_logo} />
                      <ArrowRight
                        className="text-muted-foreground size-4 shrink-0"
                        aria-hidden
                      />
                      <div className="text-right">
                        <ClubBadge name={t.to_team} logo={t.to_team_logo} />
                      </div>
                    </div>
                  </div>
                </motion.li>
              );
            })}

            {/* Club actuel en bout de timeline (highlight vert) */}
            {current_team && (
              <motion.li
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{
                  delay: displayed.length * 0.06,
                  duration: 0.35,
                }}
                className="relative"
              >
                <span
                  className="bg-primary border-card ring-primary/30 absolute -left-[33px] flex size-7 items-center justify-center rounded-full border-2 ring-4"
                  aria-hidden
                >
                  <span className="bg-card size-2.5 rounded-full" />
                </span>
                <div className="bg-primary/10 border-primary/30 rounded-xl border p-3.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-primary text-sm font-bold">
                      Aujourd&apos;hui
                    </span>
                    <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                      Club actuel
                    </span>
                  </div>
                  <ClubBadge
                    name={current_team.name}
                    logo={current_team.logo_url}
                  />
                </div>
              </motion.li>
            )}
          </ol>
        </>
      )}
    </section>
  );
}
