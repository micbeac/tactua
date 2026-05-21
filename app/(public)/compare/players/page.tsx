import type { Metadata } from 'next';
import { ArrowLeftRight, Swords, User as UserIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { PlayerSelector } from '@/components/compare/PlayerSelector';
import { RichRadarPentagon } from '@/components/match/RichRadarPentagon';
import { getPlayerCompare, type PlayerSnapshot } from '@/lib/data/player-compare';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Comparer 2 joueurs',
  description:
    'Comparaison côte à côte de 2 joueurs : radar des skills, stats détaillées, productivité et discipline.',
};

type SearchParams = Promise<{ a?: string; b?: string }>;

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

function PlayerColumn({ p }: { p: PlayerSnapshot }) {
  const age = computeAge(p.date_of_birth);
  return (
    <Link
      href={`/players/${p.id}`}
      className="flex flex-col items-center gap-2 text-center"
    >
      <div className="border-primary/40 bg-muted relative size-16 overflow-hidden rounded-full border-2 sm:size-20">
        {p.photo_url ? (
          <Image
            src={p.photo_url}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <UserIcon
            className="text-muted-foreground absolute inset-0 m-auto size-8"
            aria-hidden
          />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold sm:text-base">{p.name}</p>
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center justify-center gap-1.5 text-[10px]">
          {p.position && (
            <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 font-bold tracking-wide uppercase">
              {p.position}
            </span>
          )}
          {p.team_name && (
            <span className="tracking-wide uppercase">{p.team_name}</span>
          )}
          {age != null && (
            <span className="tracking-wide uppercase">{age} ans</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default async function ComparePlayersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { a, b } = await searchParams;
  const playerAId = a ? Number(a) : null;
  const playerBId = b ? Number(b) : null;

  const supabase = await createClient();
  const compare =
    playerAId && playerBId
      ? await getPlayerCompare(supabase, playerAId, playerBId)
      : null;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header>
        <p className="text-primary mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase">
          <Swords className="size-3.5" aria-hidden />
          Comparer
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Joueur vs Joueur
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Choisis 2 joueurs pour voir leur radar de skills, leurs stats côte à
          côte, et leur productivité.
        </p>
      </header>

      <section className="bg-card border-border rounded-2xl border p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <PlayerSelector slot="a" initial_player_id={playerAId} />
          <div className="text-muted-foreground hidden self-center pb-2 sm:block">
            <ArrowLeftRight className="size-5" aria-hidden />
          </div>
          <PlayerSelector slot="b" initial_player_id={playerBId} />
        </div>
      </section>

      {!compare && (
        <section className="bg-muted/30 border-border rounded-2xl border p-8 text-center">
          <UserIcon
            className="text-muted-foreground mx-auto mb-3 size-10 opacity-40"
            aria-hidden
          />
          <p className="text-muted-foreground text-sm">
            Choisis deux joueurs pour démarrer la comparaison.
          </p>
        </section>
      )}

      {compare && (
        <>
          <section className="bg-primary/10 border-primary/20 relative overflow-hidden rounded-2xl border p-6">
            <div className="bg-primary/20 pointer-events-none absolute -top-16 -right-16 size-64 rounded-full blur-3xl" />
            <div className="bg-emerald-400/10 pointer-events-none absolute -bottom-20 -left-20 size-72 rounded-full blur-3xl" />
            <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-6">
              <PlayerColumn p={compare.player_a} />
              <div className="text-muted-foreground text-center text-2xl font-bold sm:text-3xl">
                VS
              </div>
              <PlayerColumn p={compare.player_b} />
            </div>
          </section>

          <section className="bg-card border-border rounded-2xl border p-6">
            <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
              Radar des skills (saison)
            </h2>
            <RichRadarPentagon
              dimensions={compare.radar}
              home_team_name={compare.player_a.name}
              away_team_name={compare.player_b.name}
            />
          </section>

          <section className="bg-card border-border rounded-2xl border p-6">
            <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
              Comparaison statistique
            </h2>
            <div className="border-border overflow-hidden rounded-xl border">
              <div className="bg-muted/30 grid grid-cols-[1fr_2fr_1fr] items-center border-b px-3 py-2 text-[10px] font-semibold tracking-wide uppercase">
                <span className="text-primary truncate text-right">
                  {compare.player_a.name}
                </span>
                <span className="text-muted-foreground text-center">
                  Statistique
                </span>
                <span className="text-primary truncate">
                  {compare.player_b.name}
                </span>
              </div>
              {compare.stats_compare.map((s) => {
                const homeBest = s.advantage === 'home';
                const awayBest = s.advantage === 'away';
                return (
                  <div
                    key={s.label}
                    className="border-border grid grid-cols-[1fr_2fr_1fr] items-center border-b px-3 py-2.5 text-sm last:border-b-0"
                  >
                    <span
                      className={`truncate text-right tabular-nums ${
                        homeBest
                          ? 'text-primary font-semibold'
                          : 'text-foreground/80'
                      }`}
                    >
                      {s.home}
                    </span>
                    <span className="text-muted-foreground text-center text-xs">
                      {s.label}
                    </span>
                    <span
                      className={`truncate tabular-nums ${
                        awayBest
                          ? 'text-primary font-semibold'
                          : 'text-foreground/80'
                      }`}
                    >
                      {s.away}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
