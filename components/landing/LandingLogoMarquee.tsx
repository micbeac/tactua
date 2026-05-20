'use client';

import { motion } from 'motion/react';

const CLUBS = [
  { id: 86, name: 'Real Madrid' },
  { id: 81, name: 'FC Barcelona' },
  { id: 65, name: 'Manchester City' },
  { id: 64, name: 'Liverpool' },
  { id: 66, name: 'Manchester United' },
  { id: 5, name: 'Bayern München' },
  { id: 524, name: 'Paris SG' },
  { id: 108, name: 'Inter Milano' },
  { id: 109, name: 'Juventus' },
  { id: 98, name: 'AC Milan' },
  { id: 78, name: 'Atlético Madrid' },
  { id: 61, name: 'Chelsea' },
  { id: 57, name: 'Arsenal' },
  { id: 4, name: 'Borussia Dortmund' },
  { id: 113, name: 'Napoli' },
  { id: 73, name: 'Tottenham' },
  { id: 100, name: 'AS Roma' },
];

// On duplique la liste pour assurer une boucle visuelle continue
const LOOP = [...CLUBS, ...CLUBS];

export function LandingLogoMarquee() {
  return (
    <section className="border-border/40 border-y py-10">
      <div className="mx-auto max-w-6xl px-4">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-muted-foreground mb-6 text-center text-xs font-semibold tracking-widest uppercase"
        >
          Les clubs et compétitions que tu suis, déjà en base
        </motion.p>
      </div>

      {/* Bandeau défilant — animation CSS keyframes pour rester fluide même sur mobile */}
      <div className="group relative overflow-hidden">
        {/* Fade des bords */}
        <div className="from-background pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r to-transparent" />
        <div className="from-background pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l to-transparent" />

        <div
          className="flex gap-12 group-hover:[animation-play-state:paused]"
          style={{
            animation: 'marquee 40s linear infinite',
            width: 'max-content',
          }}
        >
          {LOOP.map((club, i) => (
            <div
              key={`${club.id}-${i}`}
              className="flex shrink-0 items-center gap-3 opacity-60 transition-opacity hover:opacity-100"
            >
              {/* Image sans Next/Image pour éviter d'avoir à allowlist le domaine */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://crests.football-data.org/${club.id}.png`}
                alt={club.name}
                className="size-12 object-contain drop-shadow-lg"
                loading="lazy"
              />
              <span className="text-foreground/80 text-sm font-medium whitespace-nowrap">
                {club.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  );
}
