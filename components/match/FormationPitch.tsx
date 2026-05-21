'use client';

import { motion, useInView } from 'motion/react';
import { useRef } from 'react';

type Props = {
  /** Formation au format "4-3-3", "4-2-3-1", "3-5-2", etc. */
  formation: string | null;
  /** Nom de l'équipe affiché en haut */
  team_name: string;
  /** Couleur principale ('primary' = vert Tactuo, 'emerald' = vert clair) */
  variant?: 'primary' | 'emerald';
  /** Largeur en px. Hauteur calculée pour ratio terrain ~1.5:1. */
  width?: number;
};

const COLORS = {
  primary: { stroke: 'oklch(0.72 0.19 145)', fill: 'oklch(0.72 0.19 145 / 0.85)' },
  emerald: { stroke: 'oklch(0.78 0.18 165)', fill: 'oklch(0.78 0.18 165 / 0.85)' },
};

/**
 * Mini-terrain de foot SVG affichant la formation type d'une équipe.
 *
 * Le terrain est dessiné vertical (l'équipe attaque vers le haut).
 * Le gardien est en bas, les attaquants en haut.
 * Chaque ligne de la formation devient une rangée de joueurs équidistants.
 */
export function FormationPitch({
  formation,
  team_name,
  variant = 'primary',
  width = 220,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });

  const height = Math.round(width * 1.45);
  const colors = COLORS[variant];

  // Parsing : "4-3-3" → [4, 3, 3]. Si pas de formation, fallback 4-3-3.
  const lines = formation
    ? formation.split('-').map((n) => parseInt(n, 10)).filter((n) => n > 0)
    : [4, 3, 3];
  const total = lines.reduce((a, b) => a + b, 0);
  const validFormation = total >= 9 && total <= 10 && lines.length >= 2;
  const finalLines = validFormation ? lines : [4, 3, 3];

  // Layout vertical :
  // - GK en bas (y = 92%)
  // - Lignes du fond (défense) au sommet (attaque) entre y=78% et y=18%
  // - L'ordre des lignes dans le tableau formation est de la défense → attaque
  const gkY = 92;
  const topY = 18;
  const bottomY = 75;
  const rowCount = finalLines.length;
  const rowYs = finalLines.map(
    (_, i) =>
      rowCount === 1 ? (topY + bottomY) / 2 : bottomY - (i * (bottomY - topY)) / (rowCount - 1),
  );

  // Génère les positions de tous les joueurs (GK + lignes)
  type Player = { x: number; y: number; index: number };
  const players: Player[] = [];
  // GK
  players.push({ x: 50, y: gkY, index: 0 });
  // Lignes
  let pIndex = 1;
  finalLines.forEach((count, lineIdx) => {
    const y = rowYs[lineIdx];
    for (let i = 0; i < count; i++) {
      const x = ((i + 1) / (count + 1)) * 100;
      players.push({ x, y, index: pIndex++ });
    }
  });

  // Dimensions terrain (en %) — viewport-friendly
  // Stade vertical : bandes, surfaces, cercle central
  return (
    <div ref={ref} className="flex flex-col items-center">
      <div className="text-muted-foreground mb-2 text-[10px] tracking-wide uppercase">
        {team_name} — {validFormation ? formation : '4-3-3 (estimé)'}
      </div>
      <svg
        viewBox="0 0 100 145"
        width={width}
        height={height}
        className="border-border bg-muted/30 rounded-lg border"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Gazon avec bandes alternées */}
        <defs>
          <linearGradient id="pitch-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.32 0.08 145 / 0.4)" />
            <stop offset="100%" stopColor="oklch(0.28 0.1 145 / 0.5)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="145" fill="url(#pitch-bg)" />
        {/* Bandes horizontales */}
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x="0"
            y={i * 29}
            width="100"
            height="14.5"
            fill="oklch(0.4 0.1 145 / 0.05)"
          />
        ))}
        {/* Cadre */}
        <rect
          x="2"
          y="2"
          width="96"
          height="141"
          fill="none"
          stroke="oklch(1 0 0 / 0.5)"
          strokeWidth="0.4"
        />
        {/* Ligne médiane */}
        <line
          x1="2"
          y1="72.5"
          x2="98"
          y2="72.5"
          stroke="oklch(1 0 0 / 0.5)"
          strokeWidth="0.4"
        />
        {/* Cercle central */}
        <circle
          cx="50"
          cy="72.5"
          r="10"
          fill="none"
          stroke="oklch(1 0 0 / 0.5)"
          strokeWidth="0.4"
        />
        <circle cx="50" cy="72.5" r="0.8" fill="oklch(1 0 0 / 0.7)" />
        {/* Surfaces de réparation haut */}
        <rect
          x="25"
          y="2"
          width="50"
          height="14"
          fill="none"
          stroke="oklch(1 0 0 / 0.5)"
          strokeWidth="0.4"
        />
        <rect
          x="38"
          y="2"
          width="24"
          height="6"
          fill="none"
          stroke="oklch(1 0 0 / 0.5)"
          strokeWidth="0.4"
        />
        {/* Surfaces de réparation bas */}
        <rect
          x="25"
          y="129"
          width="50"
          height="14"
          fill="none"
          stroke="oklch(1 0 0 / 0.5)"
          strokeWidth="0.4"
        />
        <rect
          x="38"
          y="137"
          width="24"
          height="6"
          fill="none"
          stroke="oklch(1 0 0 / 0.5)"
          strokeWidth="0.4"
        />

        {/* Joueurs */}
        {players.map((p) => (
          <motion.g
            key={p.index}
            initial={{ opacity: 0, scale: 0 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{
              delay: 0.1 + p.index * 0.05,
              duration: 0.35,
              type: 'spring',
              stiffness: 200,
            }}
            style={{ transformOrigin: `${p.x}% ${p.y}%` }}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r="3.5"
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth="0.5"
            />
            <circle cx={p.x} cy={p.y - 0.5} r="1.3" fill="white" opacity="0.5" />
          </motion.g>
        ))}
      </svg>
    </div>
  );
}
