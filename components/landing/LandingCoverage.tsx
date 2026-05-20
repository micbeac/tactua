'use client';

import { motion } from 'motion/react';
import { Trophy, Users, Activity, Globe } from 'lucide-react';

const COMPS = [
  { name: 'Premier League', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { name: 'La Liga', country: '🇪🇸' },
  { name: 'Serie A', country: '🇮🇹' },
  { name: 'Bundesliga', country: '🇩🇪' },
  { name: 'Ligue 1', country: '🇫🇷' },
  { name: 'Jupiler Pro League', country: '🇧🇪' },
  { name: 'Champions League', country: '🇪🇺' },
  { name: 'Coupe du Monde 2026', country: '🌍' },
];

const VALUE_PROPS = [
  {
    icon: Trophy,
    title: '7 compétitions majeures',
    desc: 'Top 5 européen, Champions League et toute la Coupe du Monde 2026.',
  },
  {
    icon: Users,
    title: '3 200+ joueurs trackés',
    desc: 'Stats saison, ratings par match, blessures, transferts. Tout est en base.',
  },
  {
    icon: Activity,
    title: 'Données fraîches',
    desc: 'Scores live, compositions officielles dès leur sortie, classements à jour.',
  },
  {
    icon: Globe,
    title: 'Multi-source',
    desc: 'Football-Data, API-Football Pro et OpenAI gpt-4o-mini pour la synthèse.',
  },
];

export function LandingCoverage() {
  return (
    <section className="bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-12 max-w-2xl text-center"
        >
          <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
            Couverture
          </p>
          <h2 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Tout ce qui compte, en un seul endroit
          </h2>
        </motion.div>

        {/* Bandeau compétitions défilant */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mb-12 flex flex-wrap justify-center gap-3"
        >
          {COMPS.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="bg-card border-border flex items-center gap-2 rounded-full border px-4 py-2 text-sm"
            >
              <span className="text-base">{c.country}</span>
              <span className="font-medium">{c.name}</span>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUE_PROPS.map((v, i) => (
            <motion.div
              key={v.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="bg-card border-border rounded-xl border p-5"
            >
              <div className="bg-primary/10 text-primary mb-3 flex size-9 items-center justify-center rounded-lg">
                <v.icon className="size-4" aria-hidden />
              </div>
              <h3 className="mb-1 text-sm font-semibold">{v.title}</h3>
              <p className="text-muted-foreground text-xs">{v.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
