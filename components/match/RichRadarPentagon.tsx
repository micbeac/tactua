'use client';

import { motion, useInView } from 'motion/react';
import { useRef } from 'react';
import type { RadarDimension } from '@/lib/openai/types';

type Props = {
  dimensions: RadarDimension[];
  home_team_name: string;
  away_team_name: string;
  /** Taille en px (largeur ET hauteur — c'est un carré). Par défaut 320. */
  size?: number;
};

/**
 * Radar pentagonal (vrai SVG) avec 2 polygones superposés pour comparer
 * 5 dimensions entre 2 équipes (Attaque, Défense, Forme, Régularité, Globale).
 *
 * - Pentagone fond gris discret + niveaux concentriques (20, 40, 60, 80, 100)
 * - Polygone "home" : primary, opacity 0.4, animé depuis 0
 * - Polygone "away" : emerald, opacity 0.4, animé depuis 0
 * - Labels d'axe à chaque sommet
 * - Valeurs chiffrées à chaque sommet pour les 2 équipes
 */
export function RichRadarPentagon({
  dimensions,
  home_team_name,
  away_team_name,
  size = 320,
}: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  // On force 5 dimensions (sinon la viz se casse). Si <5, on complète avec
  // des valeurs neutres.
  const dims =
    dimensions.length >= 5
      ? dimensions.slice(0, 5)
      : [
          ...dimensions,
          ...Array(5 - dimensions.length).fill({
            label: '—',
            home: 0,
            away: 0,
          }),
        ];

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.36; // rayon max du pentagone (laisse de la place pour labels)

  // Calcule le point sur le pentagone pour un axe i (0..4) et une valeur v (0-100).
  // L'axe 0 pointe vers le haut.
  function pointAt(i: number, value: number): { x: number; y: number } {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const r = (value / 100) * maxR;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  // Position du label, légèrement à l'extérieur du pentagone
  function labelPos(i: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const r = maxR + 22;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    // Anchor selon position horizontale
    let anchor: 'start' | 'middle' | 'end' = 'middle';
    if (x < cx - 4) anchor = 'end';
    else if (x > cx + 4) anchor = 'start';
    return { x, y, anchor };
  }

  // Chaînes de path SVG pour les 2 polygones
  function polyPath(values: number[]): string {
    const pts = values.map((v, i) => pointAt(i, v));
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
  }

  const homeValues = dims.map((d) => d.home);
  const awayValues = dims.map((d) => d.away);
  const homePath = polyPath(homeValues);
  const awayPath = polyPath(awayValues);
  const outerPath = polyPath([100, 100, 100, 100, 100]);

  // Niveaux concentriques (background grid)
  const levels = [20, 40, 60, 80, 100];

  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-primary/60 size-3 rounded-sm" />
          <span className="max-w-[140px] truncate">{home_team_name}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-emerald-400 size-3 rounded-sm" />
          <span className="max-w-[140px] truncate">{away_team_name}</span>
        </span>
      </div>

      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        {/* Niveaux concentriques (grid de fond) */}
        {levels.map((level) => (
          <path
            key={level}
            d={polyPath(Array(5).fill(level))}
            fill="none"
            stroke="oklch(1 0 0 / 0.08)"
            strokeWidth={1}
          />
        ))}
        {/* Axes (lignes du centre vers chaque sommet) */}
        {dims.map((_, i) => {
          const end = pointAt(i, 100);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke="oklch(1 0 0 / 0.1)"
              strokeWidth={1}
            />
          );
        })}
        {/* Polygone home (primary) */}
        <motion.path
          initial={{ opacity: 0, scale: 0 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          d={homePath}
          fill="oklch(0.72 0.19 145 / 0.35)"
          stroke="oklch(0.72 0.19 145)"
          strokeWidth={2}
        />
        {/* Polygone away (emerald) */}
        <motion.path
          initial={{ opacity: 0, scale: 0 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          d={awayPath}
          fill="oklch(0.78 0.18 165 / 0.3)"
          stroke="oklch(0.78 0.18 165)"
          strokeWidth={2}
        />
        {/* Sommets avec valeurs */}
        {dims.map((d, i) => {
          const pHome = pointAt(i, d.home);
          const pAway = pointAt(i, d.away);
          return (
            <g key={i}>
              <circle cx={pHome.x} cy={pHome.y} r={3} fill="oklch(0.72 0.19 145)" />
              <circle cx={pAway.x} cy={pAway.y} r={3} fill="oklch(0.78 0.18 165)" />
            </g>
          );
        })}
        {/* Labels d'axe */}
        {dims.map((d, i) => {
          const pos = labelPos(i);
          return (
            <text
              key={i}
              x={pos.x}
              y={pos.y}
              textAnchor={pos.anchor}
              dominantBaseline="middle"
              fontSize={11}
              fill="oklch(0.7 0.02 255)"
              fontWeight={500}
            >
              {d.label}
            </text>
          );
        })}
        {/* Bordure extérieure (pentagone 100) en plus marqué */}
        <path
          d={outerPath}
          fill="none"
          stroke="oklch(1 0 0 / 0.18)"
          strokeWidth={1.5}
        />
      </svg>

      {/* Tableau récap des valeurs sous le radar */}
      <div className="mt-3 grid w-full max-w-md grid-cols-5 gap-2 text-center text-[10px]">
        {dims.map((d) => (
          <div key={d.label}>
            <p className="text-muted-foreground mb-1 truncate">{d.label}</p>
            <p className="text-primary font-bold tabular-nums">{d.home}</p>
            <p className="font-bold tabular-nums text-emerald-300">{d.away}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
