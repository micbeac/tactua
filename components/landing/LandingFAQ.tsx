'use client';

import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { LANDING_FAQ } from './landing-faq-data';

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
