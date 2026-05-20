'use client';

import { motion, useInView, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { Sparkles, TrendingUp, Goal, Shield } from 'lucide-react';

const PROBABILITIES = [
  { label: 'FC Internazionale', value: 65, color: 'bg-primary' },
  { label: 'Match nul', value: 20, color: 'bg-muted-foreground/60' },
  { label: 'Bologna FC 1909', value: 15, color: 'bg-primary/70' },
];

const SCENARIOS = [
  {
    n: 1,
    title: 'Domination de l’Inter, victoire confortable',
    likelihood: 'élevée',
    color: 'border-primary/30 bg-primary/5',
    badge: 'text-primary',
  },
  {
    n: 2,
    title: 'Match disputé, Bologne sur le fil',
    likelihood: 'moyenne',
    color: 'border-amber-500/30 bg-amber-500/5',
    badge: 'text-amber-600',
  },
  {
    n: 3,
    title: 'Match nul avec occasions manquées',
    likelihood: 'faible',
    color: 'border-border bg-muted/40',
    badge: 'text-muted-foreground',
  },
];

export function LandingDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  // Scroll-driven : la carte se redresse en arrivant + parallax léger
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const cardRotate = useTransform(scrollYProgress, [0, 0.4, 1], [12, 0, -8]);
  const cardY = useTransform(scrollYProgress, [0, 1], [60, -60]);

  return (
    <section ref={sectionRef} id="demo" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-12 max-w-2xl text-center"
        >
          <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
            Une analyse, pas une fiche de stats
          </p>
          <h2 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Ce qu’on te livre en 15 secondes
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Notre IA ne te jette pas des chiffres bruts. Elle synthétise, te
            propose plusieurs scénarios crédibles, et explique pourquoi.
          </p>
        </motion.div>

        <div
          ref={ref}
          className="relative mx-auto max-w-4xl"
          style={{ perspective: '1200px' }}
        >
          {/* Décor de fond pour la carte */}
          <div className="bg-primary/10 pointer-events-none absolute -inset-4 -z-10 rounded-3xl blur-2xl" />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{
              rotateX: cardRotate,
              y: cardY,
              transformStyle: 'preserve-3d',
            }}
            className="bg-card border-border space-y-6 rounded-2xl border p-6 shadow-2xl sm:p-8"
          >
            {/* Header de la carte démo */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-primary size-5" aria-hidden />
                <h3 className="text-sm font-semibold">Analyse pré-match · IA</h3>
              </div>
              <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                Démo
              </span>
            </div>

            {/* Match en tête */}
            <div className="border-border flex items-center justify-between border-y py-4">
              <div>
                <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                  Serie A · Journée 38
                </p>
                <p className="mt-1 text-lg font-semibold">
                  Bologna FC <span className="text-muted-foreground">vs</span>{' '}
                  Inter Milano
                </p>
              </div>
              <p className="text-muted-foreground text-xs tabular-nums">
                23 mai 2026 · 16:00
              </p>
            </div>

            {/* Ce que disent les chiffres */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="bg-muted/40 rounded-lg p-4"
            >
              <p className="text-muted-foreground mb-2 text-[10px] tracking-wide uppercase">
                Ce que disent les chiffres
              </p>
              <p className="text-sm leading-relaxed">
                L’Inter affiche une attaque plus efficace (2,0 buts/match à
                l’extérieur) et une défense solide (0,9 but encaissé/match).
                Bologne peine à marquer à domicile (0,9 but/match) et compte 5
                indisponibles, ce qui pèse sur son XI.
              </p>
            </motion.div>

            {/* Scénarios */}
            <div>
              <p className="text-muted-foreground mb-3 text-[10px] tracking-wide uppercase">
                Scénarios possibles
              </p>
              <div className="space-y-2">
                {SCENARIOS.map((s, i) => (
                  <motion.div
                    key={s.n}
                    initial={{ opacity: 0, x: -20 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.5 + i * 0.15, duration: 0.4 }}
                    className={`flex items-center justify-between rounded-lg border p-3 ${s.color}`}
                  >
                    <p className="text-sm font-semibold">
                      Scénario #{s.n} — {s.title}
                    </p>
                    <span
                      className={`shrink-0 text-[10px] font-semibold tracking-wide uppercase ${s.badge}`}
                    >
                      {s.likelihood}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Probabilités */}
            <div>
              <p className="text-muted-foreground mb-3 text-[10px] tracking-wide uppercase">
                Probabilités
              </p>
              <div className="space-y-3">
                {PROBABILITIES.map((p, i) => (
                  <div key={p.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{p.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {p.value}%
                      </span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={inView ? { width: `${p.value}%` } : {}}
                        transition={{
                          delay: 1 + i * 0.2,
                          duration: 0.9,
                          ease: 'easeOut',
                        }}
                        className={`h-full ${p.color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tuiles BTTS / Over */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  icon: Goal,
                  label: 'Les 2 équipes marquent',
                  value: 'Non',
                  why: '18 clean sheets Inter cette saison.',
                },
                {
                  icon: TrendingUp,
                  label: 'Plus de 2.5 buts',
                  value: 'Oui',
                  why: '2,0 buts/match Inter à l’extérieur.',
                },
              ].map((t, i) => (
                <motion.div
                  key={t.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 1.6 + i * 0.1, duration: 0.4 }}
                  className="border-border rounded-lg border p-3"
                >
                  <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-[10px] uppercase">
                    <t.icon className="size-3" aria-hidden />
                    {t.label}
                  </div>
                  <p className="text-sm font-semibold">{t.value}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">{t.why}</p>
                </motion.div>
              ))}
            </div>

            {/* Confiance */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 1.9, duration: 0.5 }}
            >
              <div className="mb-1 flex items-center justify-between text-[10px] tracking-wide uppercase">
                <span className="text-muted-foreground">
                  <Shield
                    className="mr-1 inline size-3"
                    aria-hidden
                  />
                  Confiance de l’IA
                </span>
                <span className="text-primary font-semibold">Élevée</span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <motion.div
                  initial={{ width: 0 }}
                  animate={inView ? { width: '90%' } : {}}
                  transition={{ delay: 2, duration: 0.8, ease: 'easeOut' }}
                  className="bg-primary h-full"
                />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
