'use client';

import { motion, useInView, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import {
  Sparkles,
  TrendingUp,
  Goal,
  Shield,
  Activity,
  AlertTriangle,
  Users,
  Trophy,
  BarChart3,
  Star,
} from 'lucide-react';

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

const STATS_COMPARE = [
  { label: 'Buts/match (saison)', home: '1.2', away: '2.3', advantage: 'away' },
  { label: 'Buts encaissés/match', home: '1.5', away: '0.9', advantage: 'away' },
  { label: 'Clean sheets', home: '8', away: '18', advantage: 'away' },
  { label: 'Forme (10 derniers)', home: '4V-2N-4D', away: '8V-1N-1D', advantage: 'away' },
  { label: 'Possession moyenne', home: '47 %', away: '58 %', advantage: 'away' },
];

const KEY_PLAYERS = {
  home: [
    { name: 'R. Orsolini', pos: 'AD', stat: '10 buts · 8 passes déc.' },
    { name: 'L. Ferguson', pos: 'MC', stat: '7 buts · note 7.2' },
  ],
  away: [
    { name: 'Lautaro Martínez', pos: 'BU', stat: '17 buts · capitaine' },
    { name: 'N. Barella', pos: 'MC', stat: '9 passes déc. · note 7.4' },
  ],
};

// Graphe comparatif (vue Visifoot) : barres verticales pour 5 dimensions.
const RADAR_CATEGORIES = [
  { label: 'Attaque', home: 58, away: 82 },
  { label: 'Défense', home: 62, away: 88 },
  { label: 'Forme', home: 45, away: 86 },
  { label: 'Discipline', home: 71, away: 69 },
  { label: 'Globale', home: 59, away: 82 },
];

// Forme des joueurs clés : note sur les 5 derniers matchs
const PLAYER_FORM = [
  { name: 'R. Orsolini', team: 'home', ratings: [7.2, 6.5, 7.8, 7.4, 6.1] },
  { name: 'Lautaro Martínez', team: 'away', ratings: [8.4, 7.6, 8.1, 7.2, 8.6] },
  { name: 'L. Ferguson', team: 'home', ratings: [6.8, 7.0, 6.4, 6.9, 6.5] },
  { name: 'N. Barella', team: 'away', ratings: [7.4, 7.8, 7.1, 8.0, 7.4] },
];

function ratingColor(r: number): string {
  if (r >= 7.5) return 'bg-primary text-primary-foreground';
  if (r >= 6.8) return 'bg-emerald-500/30 text-emerald-300';
  if (r >= 6.0) return 'bg-amber-500/30 text-amber-300';
  return 'bg-destructive/30 text-destructive';
}

const FORM_HOME = ['W', 'W', 'D', 'L', 'L'];
const FORM_AWAY = ['W', 'D', 'W', 'W', 'D'];

const formColor = (r: string) =>
  r === 'W'
    ? 'bg-primary/20 text-primary'
    : r === 'D'
      ? 'bg-amber-500/20 text-amber-500'
      : 'bg-destructive/20 text-destructive';

export function LandingDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const cardRotate = useTransform(scrollYProgress, [0, 0.4, 1], [8, 0, -5]);
  const cardY = useTransform(scrollYProgress, [0, 1], [40, -40]);

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
            Une vraie analyse, pas une fiche de stats
          </p>
          <h2 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Ce qu’on te livre en 15 secondes
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Notre IA ne te jette pas des chiffres bruts. Elle synthétise les
            stats détaillées des deux équipes, identifie les joueurs clés, te
            propose plusieurs scénarios crédibles, et explique pourquoi.
          </p>
        </motion.div>

        <div
          ref={ref}
          className="relative mx-auto max-w-4xl"
          style={{ perspective: '1500px' }}
        >
          {/* Halos respirants */}
          <motion.div
            className="bg-primary/15 pointer-events-none absolute -inset-6 -z-10 rounded-3xl blur-3xl"
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.5, 0.9, 0.5],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="bg-emerald-400/10 pointer-events-none absolute -inset-2 -z-10 rounded-3xl blur-2xl"
            animate={{
              scale: [1.05, 1, 1.05],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.5,
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{
              rotateX: cardRotate,
              y: cardY,
              transformStyle: 'preserve-3d',
            }}
            className="bg-card border-border space-y-7 rounded-2xl border p-6 shadow-2xl sm:p-8"
          >
            {/* Header de la carte */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-primary size-5" aria-hidden />
                <h3 className="text-sm font-semibold">
                  Analyse pré-match · IA
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  Mode deep
                </span>
                <span className="bg-emerald-500/10 text-emerald-500 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  Démo
                </span>
              </div>
            </div>

            {/* Match en tête */}
            <div className="border-border flex items-center justify-between border-y py-4">
              <div>
                <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                  Serie A · Journée 38 · Stadio Renato Dall’Ara
                </p>
                <p className="mt-1 text-lg font-semibold sm:text-xl">
                  Bologna FC <span className="text-muted-foreground">vs</span>{' '}
                  Inter Milano
                </p>
              </div>
              <p className="text-muted-foreground text-xs tabular-nums">
                23 mai 2026 · 16:00
              </p>
            </div>

            {/* === Bandeau de stats clés comparées === */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-[10px] tracking-wide uppercase">
                <Activity className="size-3" aria-hidden />
                Comparaison statistique
              </div>
              <div className="border-border overflow-hidden rounded-xl border">
                <div className="bg-muted/30 grid grid-cols-[1fr_2fr_1fr] items-center border-b px-3 py-2 text-[10px] font-semibold tracking-wide uppercase">
                  <span className="text-primary text-right">Bologna</span>
                  <span className="text-muted-foreground text-center">
                    Statistique
                  </span>
                  <span className="text-primary">Inter</span>
                </div>
                {STATS_COMPARE.map((s, i) => {
                  const homeWin = s.advantage === 'home';
                  return (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, x: -10 }}
                      animate={inView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.3 + i * 0.06, duration: 0.4 }}
                      className="border-border grid grid-cols-[1fr_2fr_1fr] items-center border-b px-3 py-2.5 text-sm last:border-b-0"
                    >
                      <span
                        className={`text-right tabular-nums ${
                          homeWin
                            ? 'text-primary font-semibold'
                            : 'text-foreground/80'
                        }`}
                      >
                        {s.home}
                      </span>
                      <span className="text-muted-foreground text-center text-xs">
                        {s.label}
                      </span>
                      <span
                        className={`tabular-nums ${
                          !homeWin
                            ? 'text-primary font-semibold'
                            : 'text-foreground/80'
                        }`}
                      >
                        {s.away}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* === Graphe comparatif vertical (radar dépiauté) === */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-[10px] tracking-wide uppercase">
                <BarChart3 className="size-3" aria-hidden />
                Comparaison globale
              </div>
              {/* Légende */}
              <div className="mb-3 flex items-center justify-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="bg-primary/60 size-3 rounded-sm" />
                  Bologna
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="bg-emerald-400 size-3 rounded-sm" />
                  Inter
                </span>
              </div>
              {/* Bars verticales */}
              <div className="border-border bg-muted/20 grid grid-cols-5 items-end gap-3 rounded-xl border p-4">
                {RADAR_CATEGORIES.map((cat, i) => (
                  <div
                    key={cat.label}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="flex h-32 w-full items-end justify-center gap-1.5">
                      {/* Barre Bologna */}
                      <div className="relative flex h-full w-3 flex-col justify-end">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={
                            inView ? { height: `${cat.home}%` } : { height: 0 }
                          }
                          transition={{
                            delay: 0.6 + i * 0.08,
                            duration: 0.8,
                            ease: 'easeOut',
                          }}
                          className="bg-primary/60 w-full rounded-t-sm"
                        />
                        <motion.span
                          initial={{ opacity: 0, y: 10 }}
                          animate={
                            inView ? { opacity: 1, y: 0 } : { opacity: 0 }
                          }
                          transition={{ delay: 1.4 + i * 0.08, duration: 0.3 }}
                          className="text-foreground/80 absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold tabular-nums"
                          style={{ bottom: `${cat.home}%` }}
                        >
                          {cat.home}
                        </motion.span>
                      </div>
                      {/* Barre Inter */}
                      <div className="relative flex h-full w-3 flex-col justify-end">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={
                            inView ? { height: `${cat.away}%` } : { height: 0 }
                          }
                          transition={{
                            delay: 0.65 + i * 0.08,
                            duration: 0.8,
                            ease: 'easeOut',
                          }}
                          className="w-full rounded-t-sm bg-emerald-400"
                        />
                        <motion.span
                          initial={{ opacity: 0, y: 10 }}
                          animate={
                            inView ? { opacity: 1, y: 0 } : { opacity: 0 }
                          }
                          transition={{ delay: 1.45 + i * 0.08, duration: 0.3 }}
                          className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold tabular-nums text-emerald-300"
                          style={{ bottom: `${cat.away}%` }}
                        >
                          {cat.away}
                        </motion.span>
                      </div>
                    </div>
                    <span className="text-muted-foreground text-center text-[10px] font-medium">
                      {cat.label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* === Forme récente côte à côte === */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-[10px] tracking-wide uppercase">
                <TrendingUp className="size-3" aria-hidden />
                Forme récente · 5 derniers
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: 'Bologna', form: FORM_HOME, label: '2V-1N-2D' },
                  { name: 'Inter Milano', form: FORM_AWAY, label: '3V-2N-0D' },
                ].map((t, ti) => (
                  <div
                    key={t.name}
                    className="border-border rounded-lg border p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold">{t.name}</span>
                      <span className="text-muted-foreground text-[10px] tabular-nums">
                        {t.label}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {t.form.map((r, ri) => (
                        <motion.span
                          key={ri}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={inView ? { scale: 1, opacity: 1 } : {}}
                          transition={{
                            delay: 0.7 + ti * 0.1 + ri * 0.06,
                            duration: 0.3,
                            type: 'spring',
                          }}
                          className={`flex size-7 items-center justify-center rounded-md text-[11px] font-bold ${formColor(r)}`}
                        >
                          {r}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* === Ce que disent les chiffres === */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="bg-muted/40 rounded-lg p-4"
            >
              <p className="text-muted-foreground mb-2 text-[10px] tracking-wide uppercase">
                Ce que disent les chiffres
              </p>
              <p className="text-sm leading-relaxed">
                L’Inter affiche une attaque plus efficace (2,3 buts/match
                saison) et une défense solide (0,9 but encaissé/match). Bologne
                peine à marquer à domicile (0,9 but/match) et compte 5
                indisponibles, ce qui pèse sur son XI.
              </p>
            </motion.div>

            {/* === Joueurs clés === */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-[10px] tracking-wide uppercase">
                <Users className="size-3" aria-hidden />
                Joueurs clés à surveiller
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { team: 'Bologna', players: KEY_PLAYERS.home },
                  { team: 'Inter Milano', players: KEY_PLAYERS.away },
                ].map((side, si) => (
                  <div
                    key={side.team}
                    className="border-border bg-muted/20 space-y-2 rounded-lg border p-3"
                  >
                    <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                      {side.team}
                    </p>
                    {side.players.map((p, pi) => (
                      <motion.div
                        key={p.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{
                          delay: 0.85 + si * 0.1 + pi * 0.07,
                          duration: 0.35,
                        }}
                        className="flex items-center gap-2"
                      >
                        <div className="bg-primary/15 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                          {p.pos}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {p.name}
                          </p>
                          <p className="text-muted-foreground truncate text-[11px]">
                            {p.stat}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* === Forme des joueurs clés (notes 5 derniers matchs) === */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-[10px] tracking-wide uppercase">
                <Star className="size-3" aria-hidden />
                Forme des joueurs · notes des 5 derniers matchs
              </div>
              <div className="border-border bg-muted/20 overflow-hidden rounded-xl border">
                {PLAYER_FORM.map((p, i) => {
                  const avg =
                    p.ratings.reduce((s, r) => s + r, 0) / p.ratings.length;
                  return (
                    <motion.div
                      key={p.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={inView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.95 + i * 0.08, duration: 0.4 }}
                      className="border-border grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {p.name}
                        </p>
                        <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                          {p.team === 'home' ? 'Bologna' : 'Inter'}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {p.ratings.map((r, ri) => (
                          <motion.div
                            key={ri}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={inView ? { scale: 1, opacity: 1 } : {}}
                            transition={{
                              delay: 1.1 + i * 0.08 + ri * 0.04,
                              duration: 0.3,
                            }}
                            className={`flex size-7 items-center justify-center rounded-md text-[10px] font-bold tabular-nums ${ratingColor(r)}`}
                          >
                            {r.toFixed(1)}
                          </motion.div>
                        ))}
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-muted-foreground text-[9px] tracking-wide uppercase">
                          Moy.
                        </span>
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            avg >= 7.5
                              ? 'text-primary'
                              : avg >= 6.8
                                ? 'text-emerald-300'
                                : 'text-amber-300'
                          }`}
                        >
                          {avg.toFixed(2)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* === Scénarios === */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.85, duration: 0.5 }}
            >
              <p className="text-muted-foreground mb-3 text-[10px] tracking-wide uppercase">
                Scénarios possibles
              </p>
              <div className="space-y-2">
                {SCENARIOS.map((s, i) => (
                  <motion.div
                    key={s.n}
                    initial={{ opacity: 0, x: -20 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 1 + i * 0.12, duration: 0.4 }}
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
            </motion.div>

            {/* === Points faibles === */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 1.1, duration: 0.5 }}
            >
              <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-[10px] tracking-wide uppercase">
                <AlertTriangle className="size-3" aria-hidden />
                Points faibles
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="bg-destructive/5 border-destructive/20 rounded-lg border p-3">
                  <p className="text-muted-foreground mb-0.5 text-[10px] uppercase">
                    Bologna
                  </p>
                  <p className="text-xs">
                    11 matchs sans marquer cette saison · 5 absences
                  </p>
                </div>
                <div className="bg-destructive/5 border-destructive/20 rounded-lg border p-3">
                  <p className="text-muted-foreground mb-0.5 text-[10px] uppercase">
                    Inter Milano
                  </p>
                  <p className="text-xs">
                    3 défaites sur 18 matchs à l’extérieur
                  </p>
                </div>
              </div>
            </motion.div>

            {/* === Probabilités === */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 1.25, duration: 0.5 }}
            >
              <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-[10px] tracking-wide uppercase">
                <Trophy className="size-3" aria-hidden />
                Probabilités d’issue
              </div>
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
                          delay: 1.4 + i * 0.2,
                          duration: 0.9,
                          ease: 'easeOut',
                        }}
                        className={`h-full ${p.color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* === Tuiles BTTS / Over + Score plausible === */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  icon: Goal,
                  label: 'Les 2 marquent',
                  value: 'Non',
                  why: '18 clean sheets Inter.',
                },
                {
                  icon: TrendingUp,
                  label: 'Plus de 2.5 buts',
                  value: 'Oui',
                  why: '2,3 buts/match Inter.',
                },
                {
                  icon: Trophy,
                  label: 'Score plausible',
                  value: '0 - 2',
                  why: 'Cohérent avec les probas.',
                },
              ].map((t, i) => (
                <motion.div
                  key={t.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 1.9 + i * 0.1, duration: 0.4 }}
                  className="border-border rounded-lg border p-3"
                >
                  <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-[10px] uppercase">
                    <t.icon className="size-3" aria-hidden />
                    {t.label}
                  </div>
                  <p className="text-base font-bold">{t.value}</p>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    {t.why}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* === Confiance === */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 2.2, duration: 0.5 }}
            >
              <div className="mb-1 flex items-center justify-between text-[10px] tracking-wide uppercase">
                <span className="text-muted-foreground">
                  <Shield className="mr-1 inline size-3" aria-hidden />
                  Confiance de l’IA
                </span>
                <span className="text-primary font-semibold">Élevée</span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <motion.div
                  initial={{ width: 0 }}
                  animate={inView ? { width: '90%' } : {}}
                  transition={{ delay: 2.3, duration: 0.8, ease: 'easeOut' }}
                  className="bg-primary h-full"
                />
              </div>
              <p className="text-muted-foreground mt-2 text-[11px] italic">
                Basée sur 37 matchs joués · 14 critères croisés · GPT-4o-mini
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
