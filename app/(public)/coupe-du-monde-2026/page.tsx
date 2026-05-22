import type { Metadata } from 'next';
import { CalendarDays, Globe, Sparkles, Trophy } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { WorldCupCountdown } from '@/components/shared/WorldCupCountdown';
import { JsonLd } from '@/components/seo/JsonLd';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import {
  getAllWCMatches,
  getGroupPredictions,
  getGroupStandings,
  groupMatchesByStage,
  type WCMatch,
} from '@/lib/data/world-cup';
import { createClient } from '@/lib/supabase/server';
import { teamHref } from '@/lib/url';

type KnockoutPrediction = {
  match_id: number;
  predicted_winner_team_id: number | null;
  predicted_score_home: number | null;
  predicted_score_away: number | null;
  confidence: string | null;
};

export const metadata: Metadata = {
  title: 'Coupe du Monde 2026 · Groupes, Bracket, Pronos IA',
  description:
    "Suivi complet de la Coupe du Monde 2026 (USA / Canada / Mexique) : phase de groupes en direct, prédictions IA classements et bracket des phases finales.",
  alternates: { canonical: `${SITE_URL}/coupe-du-monde-2026` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/coupe-du-monde-2026`,
    title: 'Coupe du Monde 2026 · Tactuo',
    description:
      'Pronostics IA, classements de groupes, bracket des phases finales, analyses tactiques.',
    siteName: SITE_NAME,
  },
};

export const revalidate = 300; // 5 min

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

// Mapping ordre pour positionnement bracket
const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: 'Phase de groupes',
  LAST_16: '1/8 de finale',
  QUARTER_FINALS: 'Quarts de finale',
  SEMI_FINALS: 'Demi-finales',
  THIRD_PLACE: 'Match pour la 3e place',
  FINAL: 'Finale',
};

function MatchMini({
  m,
  prediction,
}: {
  m: WCMatch;
  prediction?: KnockoutPrediction;
}) {
  const isFinished = m.status === 'finished';
  const isLive = m.status === 'live';
  const showPrediction =
    prediction && !isFinished && !isLive && m.home && m.away;
  const predictedHomeWin =
    prediction?.predicted_winner_team_id === m.home?.id;
  return (
    <Link
      href={`/matches/${m.id}`}
      className="bg-card hover:border-primary/40 border-border group block rounded-xl border p-3 text-sm transition-colors"
    >
      <div className="text-muted-foreground mb-2 flex items-center justify-between text-[10px]">
        <span>{DATE_FMT.format(new Date(m.kickoff_at))}</span>
        {isLive && (
          <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold tracking-wide uppercase">
            <span className="bg-primary inline-block size-1 animate-pulse rounded-full" />
            Live {m.live_minute && `${m.live_minute}'`}
          </span>
        )}
        {isFinished && (
          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[9px] uppercase">
            FT
          </span>
        )}
        {showPrediction && (
          <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase">
            <Sparkles className="size-2.5" aria-hidden />
            Prono
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div
          className={`flex min-w-0 flex-1 items-center gap-2 ${
            showPrediction && predictedHomeWin ? 'opacity-100' : ''
          } ${showPrediction && !predictedHomeWin ? 'opacity-60' : ''}`}
        >
          <div className="bg-muted relative size-6 shrink-0 overflow-hidden rounded-full">
            {m.home?.logo_url && (
              <Image
                src={m.home.logo_url}
                alt=""
                fill
                sizes="24px"
                className="object-contain p-0.5"
              />
            )}
          </div>
          <span className="truncate text-xs font-medium">
            {m.home?.name ?? 'À déterminer'}
          </span>
        </div>
        <span className="text-foreground shrink-0 text-sm font-bold tabular-nums">
          {isFinished || isLive
            ? `${m.score_home ?? 0} - ${m.score_away ?? 0}`
            : showPrediction
              ? `${prediction.predicted_score_home}-${prediction.predicted_score_away}`
              : 'vs'}
        </span>
        <div
          className={`flex min-w-0 flex-1 flex-row-reverse items-center gap-2 ${
            showPrediction && !predictedHomeWin ? 'opacity-100' : ''
          } ${showPrediction && predictedHomeWin ? 'opacity-60' : ''}`}
        >
          <div className="bg-muted relative size-6 shrink-0 overflow-hidden rounded-full">
            {m.away?.logo_url && (
              <Image
                src={m.away.logo_url}
                alt=""
                fill
                sizes="24px"
                className="object-contain p-0.5"
              />
            )}
          </div>
          <span className="truncate text-xs font-medium">
            {m.away?.name ?? 'À déterminer'}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function WorldCup2026Page() {
  const supabase = await createClient();
  const [matches, standings, predictions, knockoutPredsRes] = await Promise.all([
    getAllWCMatches(supabase),
    getGroupStandings(supabase),
    getGroupPredictions(supabase),
    supabase
      .from('wc_knockout_predictions')
      .select(
        'match_id, predicted_winner_team_id, predicted_score_home, predicted_score_away, confidence',
      ),
  ]);

  const koPredsMap = new Map<number, KnockoutPrediction>();
  for (const p of (knockoutPredsRes.data ?? []) as KnockoutPrediction[]) {
    koPredsMap.set(p.match_id, p);
  }

  const byStage = groupMatchesByStage(matches);
  const hasAssignments = standings.some((g) => g.teams.length > 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SportsEvent',
          name: 'Coupe du Monde FIFA 2026',
          startDate: '2026-06-11',
          endDate: '2026-07-19',
          location: {
            '@type': 'Place',
            name: 'États-Unis / Canada / Mexique',
          },
          organizer: { '@type': 'Organization', name: 'FIFA' },
          url: `${SITE_URL}/coupe-du-monde-2026`,
        }}
      />

      {/* Hero */}
      <section className="bg-primary/10 border-primary/20 relative mb-10 overflow-hidden rounded-2xl border p-6 sm:p-10">
        <div className="bg-primary/15 pointer-events-none absolute -top-20 -right-20 size-80 rounded-full blur-3xl" />
        <div className="bg-emerald-400/10 pointer-events-none absolute -bottom-20 -left-20 size-72 rounded-full blur-3xl" />

        <p className="text-primary relative mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase">
          <Globe className="size-3.5" aria-hidden />
          USA · Canada · Mexique · 11 juin → 19 juillet 2026
        </p>
        <h1 className="relative mb-4 text-3xl font-bold tracking-tight sm:text-5xl">
          Coupe du Monde 2026
        </h1>
        <p className="text-muted-foreground relative mb-6 max-w-2xl text-sm sm:text-base">
          48 équipes, 12 groupes, 64 matchs. Pronostics IA, classements de
          groupes en direct, bracket des phases finales.
        </p>
        <div className="relative">
          <WorldCupCountdown />
        </div>
      </section>

      {/* Nav rapide */}
      <nav className="mb-10 flex flex-wrap gap-2">
        <Link
          href="#groupes"
          className="bg-card border-border hover:border-primary/40 rounded-full border px-4 py-1.5 text-xs font-semibold"
        >
          ⚽ Phase de groupes
        </Link>
        <Link
          href="#bracket"
          className="bg-card border-border hover:border-primary/40 rounded-full border px-4 py-1.5 text-xs font-semibold"
        >
          🏆 Phase finale
        </Link>
        <Link
          href="/calendrier"
          className="bg-card border-border hover:border-primary/40 rounded-full border px-4 py-1.5 text-xs font-semibold"
        >
          📅 Calendrier complet
        </Link>
      </nav>

      {/* PHASE DE GROUPES */}
      <section id="groupes" className="mb-16 scroll-mt-24">
        <header className="mb-6">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Trophy className="text-primary size-5" aria-hidden />
            Phase de groupes
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            12 groupes de 4 équipes. Top 2 + 8 meilleurs 3e qualifiés pour les
            1/16e.
          </p>
        </header>

        {!hasAssignments ? (
          <div className="bg-card border-border rounded-2xl border p-10 text-center">
            <p className="text-muted-foreground text-sm">
              Les groupes seront affichés dès le tirage au sort intégré en
              base.
            </p>
            <p className="text-muted-foreground/70 mt-1 text-xs">
              Ils sont alimentés via la migration{' '}
              <code className="bg-muted/40 rounded px-1">
                wc_group_assignments
              </code>{' '}
              (à venir).
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {standings.map((group) => {
              const prediction = predictions.get(group.letter);
              return (
                <div
                  key={group.letter}
                  className="bg-card border-border rounded-2xl border p-4"
                >
                  <header className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-bold">
                      Groupe {group.letter}
                    </h3>
                    {prediction && (
                      <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase">
                        <Sparkles className="size-2.5" aria-hidden />
                        Prono IA
                      </span>
                    )}
                  </header>
                  <ul className="space-y-1">
                    {group.teams.map((t) => {
                      const predictedPos = prediction?.ranking.find(
                        (r) => r.team_id === t.team.id,
                      )?.position;
                      const isQualifier = (t.position ?? 0) <= 2;
                      return (
                        <li
                          key={t.team.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span
                            className={`w-4 text-right tabular-nums ${
                              isQualifier
                                ? 'text-primary font-bold'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {t.position}
                          </span>
                          <div className="bg-muted relative size-5 shrink-0 overflow-hidden rounded-full">
                            {t.team.logo_url && (
                              <Image
                                src={t.team.logo_url}
                                alt=""
                                fill
                                sizes="20px"
                                className="object-contain p-0.5"
                              />
                            )}
                          </div>
                          <Link
                            href={teamHref(t.team.id, t.team.name)}
                            className="hover:text-primary flex-1 truncate font-medium"
                          >
                            {t.team.name}
                          </Link>
                          <span className="text-muted-foreground shrink-0 font-mono tabular-nums">
                            {t.played > 0
                              ? `${t.points}pts`
                              : predictedPos
                                ? `→ ${predictedPos}ᵉ`
                                : '—'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {prediction && prediction.summary && (
                    <p className="text-muted-foreground border-border/40 mt-3 border-t pt-2 text-[11px] italic">
                      {prediction.summary}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* PHASE FINALE — Bracket */}
      <section id="bracket" className="scroll-mt-24">
        <header className="mb-6">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Trophy className="text-primary size-5" aria-hidden />
            Phase finale
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            32 qualifiés → 1/16 → 1/8 → quarts → demis → finale. Les rencontres
            apparaissent au fur et à mesure des qualifications.
          </p>
        </header>

        {/* Bracket horizontal scrollable */}
        <div className="overflow-x-auto">
          <div className="flex min-w-fit gap-4">
            {(
              [
                ['LAST_16', byStage.LAST_16],
                ['QUARTER_FINALS', byStage.QUARTER_FINALS],
                ['SEMI_FINALS', byStage.SEMI_FINALS],
                ['FINAL', [...byStage.FINAL, ...byStage.THIRD_PLACE]],
              ] as const
            ).map(([stage, list]) => (
              <div key={stage} className="min-w-[260px] flex-1">
                <header className="bg-primary/10 mb-3 rounded-lg px-3 py-2">
                  <p className="text-primary text-[10px] font-bold tracking-widest uppercase">
                    {STAGE_LABELS[stage]}
                  </p>
                  <p className="text-muted-foreground text-[10px]">
                    {list.length} match{list.length > 1 ? 's' : ''}
                  </p>
                </header>
                {list.length === 0 ? (
                  <div className="bg-card border-border rounded-xl border border-dashed p-4 text-center">
                    <p className="text-muted-foreground text-xs italic">
                      À déterminer
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {list.map((m) => (
                      <MatchMini
                        key={m.id}
                        m={m}
                        prediction={koPredsMap.get(m.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <section className="border-border mt-16 border-t pt-8 text-center text-xs">
        <p className="text-muted-foreground">
          Tu suis une équipe ?{' '}
          <Link
            href="/calendrier"
            className="text-primary inline-flex items-center gap-1 font-semibold hover:underline"
          >
            <CalendarDays className="size-3.5" aria-hidden />
            Voir tous les matchs du jour
          </Link>
        </p>
      </section>
    </main>
  );
}
