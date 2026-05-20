'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingFinalCta() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      {/* Décor */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-primary/10 absolute top-1/2 left-1/2 size-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-3xl px-4 text-center"
      >
        <div className="bg-primary/10 text-primary mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
          <Sparkles className="size-3.5" aria-hidden />
          Coupe du Monde 2026 · 11 juin
        </div>

        <h2 className="mb-5 text-3xl font-semibold tracking-tight sm:text-5xl">
          Prêt à analyser tes matchs autrement ?
        </h2>
        <p className="text-muted-foreground mx-auto mb-8 max-w-xl text-base">
          Crée ton compte gratuit. Suis tes équipes, génère tes analyses, sois
          prêt pour le coup d’envoi du 11 juin.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup">
            <Button size="lg" className="gap-2">
              Créer mon compte gratuit
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              J’ai déjà un compte
            </Button>
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
