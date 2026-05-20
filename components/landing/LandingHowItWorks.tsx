'use client';

import { motion } from 'motion/react';
import { MousePointerClick, Brain, FileText } from 'lucide-react';

const STEPS = [
  {
    n: 1,
    icon: MousePointerClick,
    title: 'Choisis un match',
    desc: 'Top 5 européen, Champions League, Coupe du Monde 2026 — clique sur la fiche du match qui t’intéresse.',
  },
  {
    n: 2,
    icon: Brain,
    title: 'L’IA fait le travail',
    desc: 'Elle croise 50+ stats par équipe, forme récente, H2H, indisponibles et compositions officielles dès qu’elles sortent.',
  },
  {
    n: 3,
    icon: FileText,
    title: 'Reçois ta lecture en 15s',
    desc: '3 scénarios narrés, probabilités, points forts/faibles de chaque équipe. Tout est expliqué, rien à recroiser.',
  },
];

export function LandingHowItWorks() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-14 max-w-2xl text-center"
        >
          <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
            Comment ça marche
          </p>
          <h2 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Trois étapes, zéro effort
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Tu n’as plus à éplucher les stats joueur par joueur. Le travail
            d’analyste est fait pour toi.
          </p>
        </motion.div>

        <div className="relative grid gap-6 sm:grid-cols-3">
          {/* Trait de liaison sur desktop */}
          <div className="bg-primary/20 pointer-events-none absolute top-12 left-[16%] right-[16%] hidden h-px sm:block" />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="bg-card border-border relative rounded-2xl border p-6 text-center"
            >
              <div className="bg-card border-primary/30 text-primary relative mx-auto mb-5 flex size-12 items-center justify-center rounded-full border-2">
                <step.icon className="size-5" aria-hidden />
                <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold">
                  {step.n}
                </span>
              </div>
              <h3 className="mb-2 text-base font-semibold">{step.title}</h3>
              <p className="text-muted-foreground text-sm">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
