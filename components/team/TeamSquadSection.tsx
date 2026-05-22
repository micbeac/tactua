'use client';

import Image from 'next/image';
import { PlayerPopup } from '@/components/match/PlayerPopup';

export type SquadPlayer = {
  id: number;
  name: string;
  position: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  photo_url: string | null;
  shirt_number: number | null;
  intl_caps?: number | null;
  intl_goals?: number | null;
  intl_assists?: number | null;
};

export type SquadPlayerStats = {
  player_id: number;
  appearances: number | null;
  goals: number | null;
  assists: number | null;
};

export type TeamSquadSectionProps = {
  players: SquadPlayer[];
  /** Stats saison agrégées par player_id (toutes compétitions confondues). Optionnel. */
  stats_by_player?: Map<number, SquadPlayerStats>;
  team_name?: string;
};

type Category = 'Gardiens' | 'Défenseurs' | 'Milieux' | 'Attaquants' | 'Autres';

const ORDER: Category[] = [
  'Gardiens',
  'Défenseurs',
  'Milieux',
  'Attaquants',
  'Autres',
];

function categorize(position: string | null): Category {
  if (!position) return 'Autres';
  const p = position.toLowerCase().trim();

  // Abréviations 1-2 lettres (API-Football pour certaines compétitions)
  if (p === 'g' || p === 'gk') return 'Gardiens';
  if (p === 'd' || p === 'df') return 'Défenseurs';
  if (p === 'm' || p === 'mf') return 'Milieux';
  if (p === 'f' || p === 'a' || p === 'fw' || p === 'att')
    return 'Attaquants';

  // Mots complets (la plupart des sources)
  if (p.includes('keeper') || p.includes('gardien')) return 'Gardiens';
  if (
    p.includes('back') ||
    p.includes('defender') ||
    p.includes('défenseur') ||
    p === 'centre-back' ||
    p === 'sweeper'
  )
    return 'Défenseurs';
  if (p.includes('midfield') || p.includes('milieu')) return 'Milieux';
  if (
    p.includes('forward') ||
    p.includes('winger') ||
    p.includes('striker') ||
    p.includes('attack') ||
    p.includes('attaquant') ||
    p.includes('ailier') ||
    p.includes('avant')
  )
    return 'Attaquants';
  return 'Autres';
}

function computeAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function TeamSquadSection({
  players,
  stats_by_player,
  team_name,
}: TeamSquadSectionProps) {
  const groups = new Map<Category, SquadPlayer[]>();
  for (const p of players) {
    const cat = categorize(p.position);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(p);
  }

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Effectif</h2>
        {players.length > 0 && (
          <p className="text-muted-foreground text-xs tabular-nums">
            {players.length} joueurs
          </p>
        )}
      </header>

      {players.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          L&apos;effectif de cette équipe n&apos;est pas encore enregistré.
        </p>
      ) : (
        <div className="space-y-6">
          {ORDER.filter((c) => groups.has(c)).map((cat) => {
            const list = groups.get(cat)!;
            return (
              <div key={cat}>
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  {cat}
                  <span className="text-muted-foreground/60 ml-1.5 font-normal">
                    ({list.length})
                  </span>
                </p>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {list.map((p) => {
                    const age = computeAge(p.date_of_birth);
                    const stats = stats_by_player?.get(p.id);
                    return (
                      <li key={p.id}>
                        <PlayerPopup
                          player={{
                            name: p.name,
                            photo: p.photo_url,
                            position: p.position,
                            db_player_id: p.id,
                            shirt_number: p.shirt_number,
                            date_of_birth: p.date_of_birth,
                            nationality: p.nationality,
                            appearances: stats?.appearances ?? undefined,
                            goals: stats?.goals ?? undefined,
                            assists: stats?.assists ?? undefined,
                            intl_caps: p.intl_caps,
                            intl_goals: p.intl_goals,
                            intl_assists: p.intl_assists,
                          }}
                          team_name={team_name}
                        >
                          <div className="hover:bg-muted/40 -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors">
                            <div className="bg-muted relative size-8 shrink-0 overflow-hidden rounded-full">
                              {p.photo_url ? (
                                <Image
                                  src={p.photo_url}
                                  alt=""
                                  fill
                                  sizes="32px"
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <span className="text-muted-foreground flex h-full w-full items-center justify-center text-[10px] font-semibold">
                                  {p.shirt_number ?? p.name.charAt(0)}
                                </span>
                              )}
                            </div>
                            <span className="flex-1 truncate text-sm font-medium">
                              {p.shirt_number != null && (
                                <span className="text-muted-foreground mr-2 tabular-nums">
                                  {p.shirt_number}
                                </span>
                              )}
                              {p.name}
                            </span>
                            <span className="text-muted-foreground hidden text-xs sm:inline">
                              {[p.position, age != null ? `${age} a.` : null]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </div>
                        </PlayerPopup>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
