'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import Link from 'next/link';
import { useRef } from 'react';
import { Sparkles, ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedCounter } from './AnimatedCounter';

/**
 * Fond hero : vraie photo de stade en arrière-plan + overlay + lignes terrain.
 * - Photo Unsplash (stade vu de l'intérieur, nuit, lumières), fortement assombrie
 * - Gradient vertical qui fond la photo dans le background dark navy
 * - Halos projecteurs verts en haut
 * - Lignes de terrain en filigrane
 */
function StadiumBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Photo de fond — 3 ballons sur gazon, immédiatement reconnaissable foot */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing/stadium-hero.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover opacity-75"
        style={{ objectPosition: 'center 65%' }}
        loading="eager"
      />
      {/* Overlay assombri sur les côtés / haut / bas pour faire ressortir
       * le centre où s'affiche le texte, tout en laissant la photo bien visible */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 80% at 50% 40%, oklch(0.16 0.025 255 / 0.25) 0%, oklch(0.16 0.025 255 / 0.65) 60%, oklch(0.16 0.025 255 / 0.95) 100%)',
        }}
      />
      {/* Fondu vers le fond en bas pour transition vers la marquee */}
      <div
        className="absolute inset-x-0 bottom-0 h-32"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, oklch(0.16 0.025 255) 100%)',
        }}
      />

      {/* Halo projecteurs en haut */}
      <div className="absolute inset-x-0 top-0 h-[60%]">
        <div className="bg-primary/10 absolute top-[-20%] left-[15%] size-[600px] rounded-full blur-3xl" />
        <div className="bg-primary/8 absolute top-[-30%] right-[15%] size-[600px] rounded-full blur-3xl" />
        <div className="bg-emerald-400/5 absolute top-[5%] left-1/2 size-[800px] -translate-x-1/2 rounded-full blur-3xl" />
      </div>

      {/* Gazon en bas */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[60%] w-full"
        viewBox="0 0 1200 400"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.4 0.12 145)" stopOpacity="0" />
            <stop offset="60%" stopColor="oklch(0.4 0.12 145)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="oklch(0.3 0.15 145)" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="grass-stripe" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.5 0.15 145)" stopOpacity="0" />
            <stop offset="100%" stopColor="oklch(0.5 0.15 145)" stopOpacity="0.08" />
          </linearGradient>
          {/* Cercle central et lignes terrain en filigrane */}
          <pattern
            id="pitch-lines"
            x="0"
            y="0"
            width="1200"
            height="400"
            patternUnits="userSpaceOnUse"
          >
            <ellipse
              cx="600"
              cy="100"
              rx="180"
              ry="40"
              stroke="oklch(0.85 0.2 145)"
              strokeOpacity="0.15"
              strokeWidth="1.5"
              fill="none"
            />
            <line
              x1="600"
              y1="60"
              x2="600"
              y2="400"
              stroke="oklch(0.85 0.2 145)"
              strokeOpacity="0.15"
              strokeWidth="1.5"
            />
            <ellipse
              cx="600"
              cy="100"
              rx="3"
              ry="1.5"
              fill="oklch(0.85 0.2 145)"
              fillOpacity="0.4"
            />
          </pattern>
        </defs>
        {/* Gazon */}
        <rect width="1200" height="400" fill="url(#grass)" />
        {/* Bandes alternées (texture gazon coupé) */}
        {[0, 60, 120, 180, 240, 300].map((y, i) =>
          i % 2 === 0 ? (
            <rect
              key={y}
              x="0"
              y={y}
              width="1200"
              height="60"
              fill="url(#grass-stripe)"
            />
          ) : null,
        )}
        {/* Lignes de terrain au-dessus */}
        <rect width="1200" height="400" fill="url(#pitch-lines)" />
      </svg>

      {/* Voile sombre pour préserver la lisibilité du texte */}
      <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.16_0.025_255)] via-transparent to-[oklch(0.16_0.025_255)]/40" />
    </div>
  );
}

/** Halo lumineux qui pulse derrière le H1. */
function HeroGlow() {
  return (
    <motion.div
      className="bg-primary/20 pointer-events-none absolute top-1/2 left-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
      animate={{
        scale: [1, 1.15, 1],
        opacity: [0.5, 0.8, 0.5],
      }}
      transition={{
        duration: 5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

export function LandingHero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section ref={ref} className="relative overflow-hidden">
      <StadiumBackground />

      <motion.div
        style={{ y, opacity }}
        className="relative mx-auto max-w-6xl px-4 pt-20 pb-16 sm:pt-28 sm:pb-24"
      >
        <HeroGlow />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative mx-auto max-w-4xl text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="bg-primary/10 text-primary border-primary/20 mb-7 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase backdrop-blur"
          >
            <Sparkles className="size-3.5" aria-hidden />
            Analyses augmentées par l’IA · Coupe du Monde 2026
          </motion.div>

          {/* H1 impactant : très gros, tracking serré, dégradé sur la 2e partie + glow */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7, ease: 'easeOut' }}
            className="mb-6 text-5xl leading-[1.05] font-bold tracking-tighter sm:text-7xl lg:text-[5.5rem]"
            style={{
              textShadow:
                '0 0 60px oklch(0.72 0.19 145 / 0.25), 0 0 120px oklch(0.72 0.19 145 / 0.15)',
            }}
          >
            <span className="text-foreground block">Comprends</span>
            <span className="text-foreground block">chaque match</span>
            <span className="from-primary block bg-gradient-to-r via-emerald-400 to-emerald-300 bg-clip-text text-transparent">
              avant le coup d’envoi.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-muted-foreground mx-auto mb-9 max-w-2xl text-base sm:text-lg"
          >
            Notre IA croise stats détaillées, forme récente, compositions et
            confrontations directes pour te livrer une lecture tactique précise
            — sans jargon, sans chiffres dans tous les sens.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            {/* CTA principal avec pulse glow */}
            <div className="relative">
              <motion.div
                className="bg-primary/40 absolute inset-0 -z-10 rounded-full blur-xl"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <Link href="/signup">
                <Button
                  size="lg"
                  className="gap-2 px-7 py-6 text-base font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transition-all"
                >
                  Créer mon compte gratuit
                  <ArrowRight className="size-5" aria-hidden />
                </Button>
              </Link>
            </div>

            <a href="#demo">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 px-6 py-6 text-base backdrop-blur"
              >
                <Play className="size-4" aria-hidden />
                Voir un exemple d’analyse
              </Button>
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85, duration: 0.5 }}
            className="text-muted-foreground/80 mt-7 text-xs"
          >
            Premier 5 européen · Champions League · 48 sélections WC 2026 · 100 %
            gratuit jusqu’au lancement
          </motion.p>
        </motion.div>

        {/* Bandeau de chiffres animés — entrée stagger + flottement continu */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.7, ease: 'easeOut' }}
          className="relative mx-auto mt-16 max-w-4xl"
        >
          {/* Halo de fond derrière le cadre */}
          <motion.div
            className="bg-primary/10 absolute -inset-2 -z-10 rounded-3xl blur-2xl"
            animate={{
              opacity: [0.4, 0.7, 0.4],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.div
            className="border-border bg-card/70 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border backdrop-blur-md sm:grid-cols-4"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            {[
              { value: 157, suffix: '', label: 'équipes trackées' },
              { value: 3200, suffix: '+', label: 'joueurs avec stats' },
              { value: 15, prefix: '~', suffix: 's', label: 'pour une analyse' },
              { value: 7, suffix: '', label: 'compétitions live' },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 1.1 + i * 0.12,
                  duration: 0.5,
                  ease: 'easeOut',
                }}
                whileHover={{ scale: 1.04 }}
                className="bg-card/80 group p-6 text-center backdrop-blur-md"
              >
                <p className="text-primary text-3xl font-bold tracking-tight transition-transform group-hover:scale-110">
                  <AnimatedCounter
                    value={s.value}
                    prefix={s.prefix}
                    suffix={s.suffix}
                    duration={1.8}
                  />
                </p>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  {s.label}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
