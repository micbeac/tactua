'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import Link from 'next/link';
import { useRef } from 'react';
import { Sparkles, ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedCounter } from './AnimatedCounter';

/** Petit ballon de foot SVG (stylisé minimal) qui flotte en arrière-plan. */
function FloatingBall({
  className,
  delay = 0,
  duration = 8,
}: {
  className?: string;
  delay?: number;
  duration?: number;
}) {
  return (
    <motion.div
      className={className}
      animate={{
        y: [0, -20, 0],
        rotate: [0, 360],
      }}
      transition={{
        y: {
          duration,
          delay,
          repeat: Infinity,
          ease: 'easeInOut',
        },
        rotate: {
          duration: duration * 3,
          delay,
          repeat: Infinity,
          ease: 'linear',
        },
      }}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-full opacity-40"
      >
        <circle
          cx="32"
          cy="32"
          r="30"
          fill="currentColor"
          fillOpacity="0.15"
        />
        <circle
          cx="32"
          cy="32"
          r="30"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.5"
          fill="none"
        />
        <path
          d="M32 12 L40 22 L36 32 L28 32 L24 22 Z"
          fill="currentColor"
          fillOpacity="0.4"
        />
        <path
          d="M40 22 L52 24 L50 36 L36 32 Z"
          fill="currentColor"
          fillOpacity="0.3"
        />
        <path
          d="M24 22 L12 24 L14 36 L28 32 Z"
          fill="currentColor"
          fillOpacity="0.3"
        />
        <path
          d="M36 32 L40 44 L32 52 L24 44 L28 32 Z"
          fill="currentColor"
          fillOpacity="0.35"
        />
      </svg>
    </motion.div>
  );
}

/** Fond terrain de foot SVG en filigrane. */
function PitchBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden">
      <svg
        viewBox="0 0 800 500"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary/20 size-[140%] max-w-none opacity-30"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Cadre extérieur */}
        <rect
          x="20"
          y="20"
          width="760"
          height="460"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        {/* Ligne médiane */}
        <line
          x1="400"
          y1="20"
          x2="400"
          y2="480"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {/* Cercle central */}
        <circle
          cx="400"
          cy="250"
          r="60"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="400" cy="250" r="3" fill="currentColor" />
        {/* Surface de réparation gauche */}
        <rect
          x="20"
          y="150"
          width="120"
          height="200"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <rect
          x="20"
          y="200"
          width="50"
          height="100"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="100" cy="250" r="3" fill="currentColor" />
        {/* Surface de réparation droite */}
        <rect
          x="660"
          y="150"
          width="120"
          height="200"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <rect
          x="730"
          y="200"
          width="50"
          height="100"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="700" cy="250" r="3" fill="currentColor" />
      </svg>
    </div>
  );
}

export function LandingHero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  // Parallax léger : le contenu monte un peu plus lentement que le scroll
  const y = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section ref={ref} className="relative overflow-hidden">
      <PitchBackground />

      {/* Décor de fond : orbes + ballons flottants */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-primary/15 absolute top-[-10%] left-[5%] size-[400px] rounded-full blur-3xl opacity-60" />
        <div className="bg-primary/10 absolute right-[-5%] bottom-[-20%] size-[450px] rounded-full blur-3xl opacity-60" />
      </div>

      <div className="pointer-events-none absolute inset-0 text-emerald-400">
        <FloatingBall className="absolute top-[15%] left-[8%] size-12" delay={0} duration={6} />
        <FloatingBall
          className="absolute top-[55%] right-[6%] size-16"
          delay={1.5}
          duration={8}
        />
        <FloatingBall
          className="absolute top-[35%] right-[15%] size-8"
          delay={3}
          duration={7}
        />
        <FloatingBall
          className="absolute top-[70%] left-[12%] size-10"
          delay={2}
          duration={9}
        />
      </div>

      <motion.div
        style={{ y, opacity }}
        className="mx-auto max-w-6xl px-4 pt-20 pb-16 sm:pt-28 sm:pb-24"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="bg-primary/10 text-primary border-primary/20 mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase"
          >
            <Sparkles className="size-3.5" aria-hidden />
            Analyses augmentées par l’IA · Coupe du Monde 2026
          </motion.div>

          <h1 className="text-foreground mb-5 text-4xl font-semibold tracking-tight sm:text-6xl">
            Comprends chaque match{' '}
            <span className="from-primary relative inline-block bg-gradient-to-r to-emerald-400 bg-clip-text text-transparent">
              avant le coup d’envoi.
            </span>
          </h1>

          <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-base sm:text-lg">
            Notre IA croise stats détaillées, forme récente, compositions et
            confrontations directes pour te livrer une lecture tactique précise
            — sans jargon, sans chiffres dans tous les sens.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup">
              <Button size="lg" className="gap-2">
                Créer mon compte gratuit
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </Link>
            <a href="#demo">
              <Button size="lg" variant="outline" className="gap-2">
                <Play className="size-4" aria-hidden />
                Voir un exemple d’analyse
              </Button>
            </a>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-muted-foreground/80 mt-6 text-xs"
          >
            Premier 5 européen · Champions League · 48 sélections WC 2026 · 100 %
            gratuit jusqu’au lancement
          </motion.p>
        </motion.div>

        {/* Bandeau de chiffres animés */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="border-border bg-card/50 mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border backdrop-blur sm:grid-cols-4"
        >
          {[
            { value: 157, suffix: '', label: 'équipes trackées' },
            { value: 3200, suffix: '+', label: 'joueurs avec stats' },
            { value: 15, prefix: '~', suffix: 's', label: 'pour une analyse' },
            { value: 7, suffix: '', label: 'compétitions live' },
          ].map((s) => (
            <div key={s.label} className="bg-card p-5 text-center">
              <p className="text-primary text-2xl font-semibold">
                <AnimatedCounter
                  value={s.value}
                  prefix={s.prefix}
                  suffix={s.suffix}
                />
              </p>
              <p className="text-muted-foreground mt-1 text-xs">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
