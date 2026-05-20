'use client';

import { animate, useInView } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

type Props = {
  /** Valeur finale (nombre cible). */
  value: number;
  /** Préfixe affiché avant le chiffre (ex: "~"). */
  prefix?: string;
  /** Suffixe affiché après (ex: "+", "s"). */
  suffix?: string;
  /** Durée de l'animation en secondes. */
  duration?: number;
  /** Sépare les milliers avec une espace fine (default true pour FR). */
  separator?: boolean;
};

/**
 * Compteur qui anime un nombre de 0 à `value` quand il entre dans le viewport.
 * Utilise motion.animate (rAF) pour rester fluide même sur mobile.
 */
export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  duration = 1.5,
  separator = true,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate(latest) {
        setDisplay(Math.round(latest));
      },
    });
    return () => controls.stop();
  }, [inView, value, duration]);

  const formatted = separator
    ? display.toLocaleString('fr-FR').replace(/\s/g, ' ')
    : String(display);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
