'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { Sparkles, ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Décor de fond : orbes floutées discrètes */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60">
        <div className="bg-primary/15 absolute top-[-10%] left-[5%] size-[400px] rounded-full blur-3xl" />
        <div className="bg-primary/10 absolute right-[-5%] bottom-[-20%] size-[450px] rounded-full blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-20 pb-16 sm:pt-28 sm:pb-24">
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
            className="bg-primary/10 text-primary mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase"
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

        {/* Bandeau de chiffres */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="border-border bg-card/50 mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border backdrop-blur sm:grid-cols-4"
        >
          {[
            { value: '157', label: 'équipes trackées' },
            { value: '3 200+', label: 'joueurs avec stats' },
            { value: '~15s', label: 'pour une analyse' },
            { value: '7', label: 'compétitions live' },
          ].map((s) => (
            <div key={s.label} className="bg-card p-5 text-center">
              <p className="text-primary text-2xl font-semibold tabular-nums">
                {s.value}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
