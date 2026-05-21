'use client';

import {
  Award,
  ExternalLink,
  TrendingUp,
  Trophy,
  User as UserIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { PlayerSeasonStat } from '@/lib/openai/types';

type Props = {
  player: PlayerSeasonStat;
  /** Élément cliquable qui ouvre le popup (rendu tel quel + onClick injecté). */
  children: ReactNode;
  /** Nom du club côté affichage (passé depuis l'appelant). */
  team_name: string;
};

function ratingColor(r: number | null): string {
  if (r == null) return 'text-muted-foreground';
  if (r >= 7.5) return 'text-primary';
  if (r >= 6.8) return 'text-emerald-300';
  if (r >= 6.0) return 'text-amber-300';
  return 'text-destructive';
}

function StatBlock({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="border-border bg-muted/30 rounded-lg border p-3 text-center">
      <p
        className={`text-lg font-bold tabular-nums ${
          highlight ? 'text-primary' : 'text-foreground'
        }`}
      >
        {value}
      </p>
      <p className="text-muted-foreground mt-0.5 text-[10px] tracking-wide uppercase">
        {label}
      </p>
    </div>
  );
}

export function PlayerPopup({ player, children, team_name }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        role="button"
        tabIndex={0}
        className="cursor-pointer"
      >
        {children}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-md border p-0 sm:max-w-md">
        <DialogTitle className="sr-only">{player.name}</DialogTitle>

        {/* Header avec photo */}
        <div className="bg-primary/10 relative overflow-hidden rounded-t-xl p-6">
          {/* Halo décoratif */}
          <div className="bg-primary/20 pointer-events-none absolute -top-10 -right-10 size-40 rounded-full blur-3xl" />

          <div className="relative flex items-center gap-4">
            {player.photo ? (
              <div className="border-primary/30 relative size-20 shrink-0 overflow-hidden rounded-full border-2">
                <Image
                  src={player.photo}
                  alt={player.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="bg-muted border-primary/30 flex size-20 shrink-0 items-center justify-center rounded-full border-2">
                <UserIcon className="text-muted-foreground size-10" aria-hidden />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xl font-bold">
                {player.name}
                {player.is_captain && (
                  <span className="text-primary ml-1.5 text-xs">(C)</span>
                )}
              </h3>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {player.position && (
                  <span className="bg-primary/15 text-primary mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                    {player.position}
                  </span>
                )}
                {team_name}
              </p>
            </div>
          </div>
        </div>

        {/* Stats principales */}
        <div className="space-y-4 p-6 pt-4">
          <div>
            <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase">
              <Award className="size-3" aria-hidden />
              Stats saison
            </p>
            <div className="grid grid-cols-3 gap-2">
              <StatBlock label="Titularisations" value={player.appearances} />
              <StatBlock label="Buts" value={player.goals} highlight />
              <StatBlock label="Passes déc." value={player.assists} highlight />
            </div>
          </div>

          {(player.rating != null ||
            player.shots_on_target != null ||
            player.key_passes != null) && (
            <div>
              <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase">
                <TrendingUp className="size-3" aria-hidden />
                Performance détaillée
              </p>
              <div className="border-border space-y-2 rounded-lg border p-3">
                {player.rating != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Note moyenne</span>
                    <span
                      className={`font-bold tabular-nums ${ratingColor(player.rating)}`}
                    >
                      {player.rating.toFixed(2)}
                    </span>
                  </div>
                )}
                {player.shots_on_target != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tirs cadrés</span>
                    <span className="font-bold tabular-nums">
                      {player.shots_on_target}
                    </span>
                  </div>
                )}
                {player.key_passes != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Passes clés</span>
                    <span className="font-bold tabular-nums">
                      {player.key_passes}
                    </span>
                  </div>
                )}
                {player.passes_accuracy != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Précision passes</span>
                    <span className="font-bold tabular-nums">
                      {Math.round(player.passes_accuracy)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {player.is_captain && (
            <div className="bg-primary/5 border-primary/30 flex items-center gap-2 rounded-lg border p-3 text-xs">
              <Trophy className="text-primary size-4 shrink-0" aria-hidden />
              <span>Capitaine de l&apos;équipe cette saison</span>
            </div>
          )}

          {/* CTA voir profil complet */}
          {player.db_player_id != null ? (
            <Link
              href={`/players/${player.db_player_id}`}
              className="block"
              onClick={() => setOpen(false)}
            >
              <Button variant="outline" className="w-full gap-2">
                <ExternalLink className="size-4" aria-hidden />
                Voir le profil complet
              </Button>
            </Link>
          ) : (
            <p className="text-muted-foreground/70 text-center text-xs italic">
              Profil détaillé bientôt disponible
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
