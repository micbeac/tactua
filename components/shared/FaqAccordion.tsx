'use client';

import { Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

// Accordéon FAQ générique réutilisable (page CDM, pages-guides…).
// Le JSON-LD FAQPage est injecté séparément côté serveur par la page hôte.

export type FaqItem = { q: string; a: string };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
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
              animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <p className="text-muted-foreground px-5 pb-5 text-sm leading-relaxed">
                {item.a}
              </p>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
