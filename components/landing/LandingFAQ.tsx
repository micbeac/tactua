'use client';

import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';

export const LANDING_FAQ = [
  {
    q: 'Comment fonctionne l’IA ?',
    a: 'On combine plusieurs sources de données football (stats équipes, performances joueurs, blessures, compositions), puis on les passe à un modèle GPT-4o-mini avec des consignes strictes. Le modèle ne devine rien : il synthétise ce que les chiffres disent.',
  },
  {
    q: 'C’est gratuit ?',
    a: 'Oui, totalement jusqu’au lancement public de Tactuo (juin 2026). Ensuite, un plan free avec quelques analyses par jour et un plan payant pour les analyses illimitées et détaillées.',
  },
  {
    q: 'Est-ce que c’est une app de paris sportifs ?',
    a: 'Non. Tactuo positionne l’analyse comme un outil de compréhension : "voici tout ce qu’il faut savoir avant le match". On donne des probabilités et des scénarios, jamais de conseil de pari.',
  },
  {
    q: 'Quelles compétitions sont couvertes ?',
    a: 'Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League et toute la Coupe du Monde 2026 (48 sélections). D’autres compétitions arriveront après le lancement.',
  },
  {
    q: 'Mes données sont-elles fiables ?',
    a: 'Football-Data.org pour la structure (calendrier, classements), API-Football Pro pour les stats détaillées et compositions officielles. Mises à jour quotidiennes.',
  },
];

export function LandingFAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center"
        >
          <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
            Questions fréquentes
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Tout ce que tu veux savoir
          </h2>
        </motion.div>

        <div className="space-y-3">
          {LANDING_FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className="bg-card border-border overflow-hidden rounded-xl border"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="hover:bg-muted/40 flex w-full items-center justify-between gap-4 p-5 text-left transition-colors"
                >
                  <span className="text-sm font-semibold sm:text-base">
                    {item.q}
                  </span>
                  <Plus
                    className={`text-muted-foreground size-4 shrink-0 transition-transform ${
                      isOpen ? 'rotate-45' : ''
                    }`}
                    aria-hidden
                  />
                </button>
                <motion.div
                  initial={false}
                  animate={{
                    height: isOpen ? 'auto' : 0,
                    opacity: isOpen ? 1 : 0,
                  }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <p className="text-muted-foreground px-5 pb-5 text-sm">
                    {item.a}
                  </p>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
