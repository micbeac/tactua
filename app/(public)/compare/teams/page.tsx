import type { Metadata } from 'next';
import { ArrowLeftRight, Swords } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { TeamHistoryCompareSection } from '@/components/compare/TeamHistoryCompare';
import { TeamSelector } from '@/components/compare/TeamSelector';
import { RichRadarPentagon } from '@/components/match/RichRadarPentagon';
import { getTeamCompare } from '@/lib/data/team-compare';
import { getTeamHistoryCompare } from '@/lib/data/team-history-compare';
import { createClient } from '@/lib/supabase/server';
import { teamHref } from '@/lib/url';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Comparer 2 équipes',
  description:
    'Comparaison côte à côte de 2 équipes : radar des forces, stats détaillées, forme récente et confrontations directes.',
};

type SearchParams = Promise<{ a?: string; b?: string }>;

export default async function CompareTeamsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { a, b } = await searchParams;
  const teamAId = a ? Number(a) : null;
  const teamBId = b ? Number(b) : null;

  const supabase = await createClient();

  const [compare, history] =
    teamAId && teamBId
      ? await Promise.all([
          getTeamCompare(supabase, teamAId, teamBId),
          getTeamHistoryCompare(supabase, teamAId, teamBId),
        ])
      : [null, null];

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header>
        <p className="text-primary mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase">
          <Swords className="size-3.5" aria-hidden />
          Comparer
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Équipe vs Équipe
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Choisis 2 équipes pour voir leur radar comparé, leurs stats côte à
          côte, et leur forme.
        </p>
      </header>

      {/* Sélecteurs */}
      <section className="bg-card border-border rounded-2xl border p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <TeamSelector slot="a" initial_team_id={teamAId} />
          <div className="text-muted-foreground hidden self-center pb-2 sm:block">
            <ArrowLeftRight className="size-5" aria-hidden />
          </div>
          <TeamSelector slot="b" initial_team_id={teamBId} />
        </div>
      </section>

      {/* Si pas de sélection → call to action */}
      {!compare && (
        <section className="bg-muted/30 border-border rounded-2xl border p-8 text-center">
          <Swords
            className="text-muted-foreground mx-auto mb-3 size-10 opacity-40"
            aria-hidden
          />
          <p className="text-muted-foreground text-sm">
            Choisis deux équipes pour démarrer la comparaison.
          </p>
        </section>
      )}

      {compare && (
        <>
          {/* Header des 2 équipes */}
          <section className="bg-primary/10 border-primary/20 relative overflow-hidden rounded-2xl border p-6">
            <div className="bg-primary/20 pointer-events-none absolute -top-16 -right-16 size-64 rounded-full blur-3xl" />
            <div className="bg-emerald-400/10 pointer-events-none absolute -bottom-20 -left-20 size-72 rounded-full blur-3xl" />

            <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-6">
              <Link
                href={teamHref(compare.team_a.id, compare.team_a.name)}
                className="flex flex-col items-center gap-2 text-center"
              >
                <div className="border-primary/40 bg-muted relative size-16 overflow-hidden rounded-full border-2 sm:size-20">
                  {compare.team_a.logo_url && (
                    <Image
                      src={compare.team_a.logo_url}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-contain p-2"
                      unoptimized
                    />
                  )}
                </div>
                <p className="text-sm font-semibold sm:text-base">
                  {compare.team_a.name}
                </p>
                {compare.team_a.competition_name && (
                  <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                    {compare.team_a.competition_name}
                  </p>
                )}
              </Link>

              <div className="text-muted-foreground text-center text-2xl font-bold sm:text-3xl">
                VS
              </div>

              <Link
                href={teamHref(compare.team_b.id, compare.team_b.name)}
                className="flex flex-col items-center gap-2 text-center"
              >
                <div className="border-primary/40 bg-muted relative size-16 overflow-hidden rounded-full border-2 sm:size-20">
                  {compare.team_b.logo_url && (
                    <Image
                      src={compare.team_b.logo_url}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-contain p-2"
                      unoptimized
                    />
                  )}
                </div>
                <p className="text-sm font-semibold sm:text-base">
                  {compare.team_b.name}
                </p>
                {compare.team_b.competition_name && (
                  <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                    {compare.team_b.competition_name}
                  </p>
                )}
              </Link>
            </div>
          </section>

          {/* Radar comparatif */}
          <section className="bg-card border-border rounded-2xl border p-6">
            <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
              Comparaison globale
            </h2>
            <RichRadarPentagon
              dimensions={compare.radar}
              home_team_name={compare.team_a.name}
              away_team_name={compare.team_b.name}
            />
          </section>

          {/* Tableau stats */}
          <section className="bg-card border-border rounded-2xl border p-6">
            <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
              Comparaison statistique
            </h2>
            <div className="border-border overflow-hidden rounded-xl border">
              <div className="bg-muted/30 grid grid-cols-[1fr_2fr_1fr] items-center border-b px-3 py-2 text-[10px] font-semibold tracking-wide uppercase">
                <span className="text-primary truncate text-right">
                  {compare.team_a.name}
                </span>
                <span className="text-muted-foreground text-center">
                  Statistique
                </span>
                <span className="text-primary truncate">
                  {compare.team_b.name}
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

          {/* Forme récente */}
          {(compare.form_a.length > 0 || compare.form_b.length > 0) && (
            <section className="bg-card border-border rounded-2xl border p-6">
              <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                Forme récente · 5 derniers
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: compare.team_a.name, form: compare.form_a },
                  { name: compare.team_b.name, form: compare.form_b },
                ].map((t) => {
                  const w = t.form.filter((r) => r === 'W').length;
                  const d = t.form.filter((r) => r === 'D').length;
                  const l = t.form.filter((r) => r === 'L').length;
                  return (
                    <div
                      key={t.name}
                      className="border-border rounded-lg border p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="truncate text-xs font-semibold">
                          {t.name}
                        </span>
                        <span className="text-muted-foreground text-[10px] tabular-nums">
                          {w}V-{d}N-{l}D
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        {t.form.map((r, ri) => (
                          <span
                            key={ri}
                            className={`flex size-7 items-center justify-center rounded-md text-[11px] font-bold ${
                              r === 'W'
                                ? 'bg-primary/20 text-primary'
                                : r === 'D'
                                  ? 'bg-amber-500/20 text-amber-500'
                                  : 'bg-destructive/20 text-destructive'
                            }`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Historique multi-saisons */}
          {history && (
            <TeamHistoryCompareSection
              team_a_name={compare.team_a.name}
              team_b_name={compare.team_b.name}
              data={history}
            />
          )}

          {/* H2H récap */}
          {compare.h2h.total > 0 && (
            <section className="bg-card border-border rounded-2xl border p-6">
              <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                Confrontations directes · {compare.h2h.total} matchs
              </h2>
              <div className="border-border bg-muted/20 grid grid-cols-3 overflow-hidden rounded-lg border">
                <div className="border-border border-r p-3 text-center">
                  <p className="text-primary text-2xl font-bold tabular-nums">
                    {compare.h2h.a_wins}
                  </p>
                  <p className="text-muted-foreground mt-1 truncate text-[10px] tracking-wide uppercase">
                    {compare.team_a.name}
                  </p>
                </div>
                <div className="border-border border-r p-3 text-center">
                  <p className="text-muted-foreground text-2xl font-bold tabular-nums">
                    {compare.h2h.draws}
                  </p>
                  <p className="text-muted-foreground mt-1 text-[10px] tracking-wide uppercase">
                    Nuls
                  </p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-primary text-2xl font-bold tabular-nums">
                    {compare.h2h.b_wins}
                  </p>
                  <p className="text-muted-foreground mt-1 truncate text-[10px] tracking-wide uppercase">
                    {compare.team_b.name}
                  </p>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
