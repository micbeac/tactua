'use client';

import { Sparkles, UserPlus } from 'lucide-react';
import Image from 'next/image';
import { PlayerPopup } from '@/components/match/PlayerPopup';
import type { RecommendedPlayer } from '@/lib/data/recommendations';

export type PlayerRecommendationsSectionProps = {
  players: RecommendedPlayer[];
  /** Nb équipes favorites — affiché dans le titre */
  favorite_teams_count: number;
};

export function PlayerRecommendationsSection({
  players,
  favorite_teams_count,
}: PlayerRecommendationsSectionProps) {
  if (players.length === 0) return null;

  return (
    <section className="mb-12">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="text-primary size-5" aria-hidden />
            Suggestions pour toi
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Basé sur tes {favorite_teams_count} équipe
            {favorite_teams_count > 1 ? 's' : ''} favorite
            {favorite_teams_count > 1 ? 's' : ''} — clique pour voir le profil
          </p>
        </div>
      </header>

      {/* Scroll horizontal sur mobile, grille sur desktop */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:grid sm:snap-none sm:grid-cols-4 sm:overflow-visible sm:pb-0">
          {players.map((p) => (
            <PlayerPopup
              key={p.player_id}
              player={{
                name: p.name,
                photo: p.photo_url,
                position: p.position,
                shirt_number: p.shirt_number,
                db_player_id: p.player_id,
                appearances: p.appearances,
                goals: p.goals,
                assists: p.assists,
              }}
              team_name={p.team_name}
            >
              <article className="bg-card hover:border-primary/40 border-border w-[180px] shrink-0 snap-start overflow-hidden rounded-xl border transition-all hover:shadow-lg sm:w-auto">
                {/* Bande de teasing en haut avec le logo équipe */}
                <div className="bg-primary/10 relative flex h-16 items-center justify-center overflow-hidden border-b border-primary/20">
                  <div className="bg-primary/20 pointer-events-none absolute -top-4 -right-4 size-24 rounded-full blur-2xl" />
                  {p.team_logo && (
                    <div className="absolute right-2 bottom-2 size-7 opacity-60">
                      <Image
                        src={p.team_logo}
                        alt=""
                        fill
                        sizes="28px"
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  )}
                  {/* Photo joueur */}
                  <div className="border-primary/40 bg-background relative -mb-8 size-16 overflow-hidden rounded-full border-2 shadow-lg">
                    {p.photo_url ? (
                      <Image
                        src={p.photo_url}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="text-muted-foreground flex h-full w-full items-center justify-center text-lg font-bold">
                        {p.shirt_number ?? p.name.charAt(0)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-3 pt-10 pb-3 text-center">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  {p.position && (
                    <p className="text-primary mt-0.5 text-[10px] font-bold tracking-wide uppercase">
                      {p.position}
                    </p>
                  )}
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-[11px]">
                    {p.reason}
                  </p>

                  {/* Mini-stats */}
                  <div className="text-muted-foreground mt-2.5 flex items-center justify-center gap-2 text-[10px] tracking-wide uppercase">
                    <span>
                      <span className="text-primary font-bold tabular-nums">
                        {p.appearances}
                      </span>{' '}
                      titu
                    </span>
                    <span>·</span>
                    <span>
                      <span className="text-primary font-bold tabular-nums">
                        {p.goals}
                      </span>
                      b
                    </span>
                    <span>·</span>
                    <span>
                      <span className="text-primary font-bold tabular-nums">
                        {p.assists}
                      </span>
                      a
                    </span>
                  </div>

                  {/* Hint click */}
                  <div className="text-primary mt-3 flex items-center justify-center gap-1 text-[10px] font-semibold">
                    <UserPlus className="size-3" aria-hidden />
                    Découvrir
                  </div>
                </div>
              </article>
            </PlayerPopup>
          ))}
        </div>
      </div>
    </section>
  );
}
