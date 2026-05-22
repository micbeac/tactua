import type { Metadata } from 'next';
import { CalendarDays, Globe, Newspaper, Sparkles, Trophy } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { CompetitionAccordion } from '@/components/dashboard/CompetitionAccordion';
import { MatchesOfDaySection } from '@/components/dashboard/MatchesOfDaySection';
import type { MatchCardProps } from '@/components/match/MatchCard';
import { FaqAccordion } from '@/components/shared/FaqAccordion';
import { WorldCupCountdown } from '@/components/shared/WorldCupCountdown';
import { buildFaqPageJsonLd, JsonLd } from '@/components/seo/JsonLd';
import { WC_FACTS, WC_FAQ } from '@/lib/content/world-cup';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import {
  getAllWCMatches,
  getGroupPredictions,
  getGroupStandings,
  groupMatchesByStage,
  WC_COMPETITION_ID,
  type WCMatch,
} from '@/lib/data/world-cup';
import { getLatestWCNews } from '@/lib/data/wc-news';
import { getMatchesForDay, todayParis } from '@/lib/matchday';
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

// Accordéons "tous les matchs" par stage, dans l'ordre du tournoi.
const STAGE_ACCORDIONS: Array<{
  key: keyof ReturnType<typeof groupMatchesByStage>;
  emoji: string;
}> = [
  { key: 'GROUP_STAGE', emoji: '⚽' },
  { key: 'LAST_16', emoji: '🏆' },
  { key: 'QUARTER_FINALS', emoji: '🏆' },
  { key: 'SEMI_FINALS', emoji: '🏆' },
  { key: 'THIRD_PLACE', emoji: '🥉' },
  { key: 'FINAL', emoji: '🏅' },
];

/** Convertit un WCMatch en MatchCardProps pour les accordéons. */
function wcToCard(m: WCMatch): MatchCardProps {
  return {
    id: m.id,
    kickoff_at: m.kickoff_at,
    status: m.status,
    stage: m.stage,
    matchday: null,
    score_home: m.score_home,
    score_away: m.score_away,
    home: {
      id: m.home?.id ?? null,
      name: m.home?.name ?? 'À déterminer',
      tla: m.home?.tla ?? null,
      logo_url: m.home?.logo_url ?? null,
    },
    away: {
      id: m.away?.id ?? null,
      name: m.away?.name ?? 'À déterminer',
      tla: m.away?.tla ?? null,
      logo_url: m.away?.logo_url ?? null,
    },
  };
}

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
  const today = todayParis();
  const [
    matches,
    standings,
    predictions,
    knockoutPredsRes,
    todayGroups,
    wcNews,
  ] = await Promise.all([
    getAllWCMatches(supabase),
    getGroupStandings(supabase),
    getGroupPredictions(supabase),
    supabase
      .from('wc_knockout_predictions')
      .select(
        'match_id, predicted_winner_team_id, predicted_score_home, predicted_score_away, confidence',
      ),
    getMatchesForDay(supabase, today, WC_COMPETITION_ID),
    getLatestWCNews(supabase, 6),
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
      <JsonLd
        data={buildFaqPageJsonLd(
          WC_FAQ.map((f) => ({ question: f.q, answer: f.a })),
        )}
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
          48 équipes, 12 groupes, 104 matchs. Pronostics IA, classements de
          groupes en direct, bracket des phases finales.
        </p>
        <div className="relative">
          <WorldCupCountdown
            kickoff_iso={
              matches.find((m) => m.stage === 'GROUP_STAGE')?.kickoff_at
            }
          />
        </div>
      </section>

      {/* L'ESSENTIEL — contenu éditorial indexable */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-semibold tracking-tight">
          La Coupe du Monde 2026 en bref
        </h2>
        <div className="text-muted-foreground space-y-3 text-sm leading-relaxed sm:text-base">
          <p>
            La Coupe du Monde 2026 est la {WC_FACTS.edition}. Elle se déroule
            du <strong className="text-foreground">{WC_FACTS.startLabel}</strong>{' '}
            au <strong className="text-foreground">{WC_FACTS.endLabel}</strong>,
            et marque un tournant dans l&apos;histoire du tournoi : c&apos;est
            la première édition organisée conjointement par{' '}
            <strong className="text-foreground">trois pays</strong> — les
            États-Unis, le Canada et le Mexique — et la première à réunir{' '}
            <strong className="text-foreground">48 sélections</strong> au lieu
            de 32.
          </p>
          <p>
            Ce nouveau format porte le nombre de rencontres à{' '}
            <strong className="text-foreground">104 matchs</strong>, répartis
            sur {WC_FACTS.hostCitiesCount} villes hôtes. Les 48 équipes sont
            réparties en 12 groupes de 4 : les deux premiers de chaque groupe et
            les huit meilleurs troisièmes se qualifient pour une phase à
            élimination directe inédite, qui débute par des 16ᵉ de finale. La
            compétition s&apos;ouvre le 11 juin 2026 à l&apos;Estadio Azteca de
            Mexico et se conclut par la finale du 19 juillet au MetLife Stadium
            de New York / New Jersey.
          </p>
        </div>

        {/* Chiffres clés */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { value: '48', label: 'équipes' },
            { value: '104', label: 'matchs' },
            { value: '16', label: 'villes hôtes' },
            { value: '3', label: 'pays organisateurs' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-card border-border rounded-xl border p-4 text-center"
            >
              <p className="text-primary text-3xl font-bold tabular-nums">
                {stat.value}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Liens vers les guides */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            {
              href: '/coupe-du-monde-2026/format',
              title: 'Le format à 48 équipes',
              desc: 'Groupes, qualifiés, élimination directe — comment ça marche.',
            },
            {
              href: '/coupe-du-monde-2026/villes-hotes',
              title: 'Les 16 villes hôtes',
              desc: 'Stades et villes des États-Unis, du Canada et du Mexique.',
            },
            {
              href: '/coupe-du-monde-2026/calendrier',
              title: 'Le calendrier complet',
              desc: 'Dates clés, du match d’ouverture à la finale.',
            },
          ].map((g) => (
            <Link
              key={g.href}
              href={g.href}
              className="bg-card border-border hover:border-primary/40 group rounded-xl border p-4 transition-colors"
            >
              <p className="group-hover:text-primary text-sm font-semibold">
                {g.title}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">{g.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Nav rapide */}
      <nav className="mb-10 flex flex-wrap gap-2">
        <Link
          href="#matchs"
          className="bg-card border-border hover:border-primary/40 rounded-full border px-4 py-1.5 text-xs font-semibold"
        >
          📅 Tous les matchs
        </Link>
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
        {wcNews.length > 0 && (
          <Link
            href="#actu"
            className="bg-card border-border hover:border-primary/40 rounded-full border px-4 py-1.5 text-xs font-semibold"
          >
            📰 Actu des sélections
          </Link>
        )}
        <Link
          href="#faq"
          className="bg-card border-border hover:border-primary/40 rounded-full border px-4 py-1.5 text-xs font-semibold"
        >
          ❓ Questions fréquentes
        </Link>
      </nav>

      {/* TOUS LES MATCHS — vue jour + accordéons par stage */}
      <section id="matchs" className="mb-16 scroll-mt-24">
        <header className="mb-6">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <CalendarDays className="text-primary size-5" aria-hidden />
            Tous les matchs
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Les 104 rencontres du tournoi. Navigue jour par jour ou déplie une
            phase.
          </p>
        </header>

        {/* Matchs du jour — navigation jour, scores live, fermé par défaut */}
        <MatchesOfDaySection
          initial_date={today}
          initial_groups={todayGroups}
          today={today}
          competition_id={WC_COMPETITION_ID}
          default_open={false}
          storage_code="cdm-matchs-du-jour"
        />

        {/* Un accordéon par phase, fermé par défaut */}
        {STAGE_ACCORDIONS.filter((s) => byStage[s.key].length > 0).map((s) => (
          <CompetitionAccordion
            key={s.key}
            code={`cdm-${s.key.toLowerCase()}`}
            label={STAGE_LABELS[s.key] ?? s.key}
            flag={s.emoji}
            matches={byStage[s.key].map(wcToCard)}
            default_open={false}
            view_all_href={null}
            empty_label="Rencontres à déterminer."
          />
        ))}
      </section>

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

      {/* ACTU DES SÉLECTIONS — dernières narratives IA des équipes nationales */}
      {wcNews.length > 0 && (
        <section id="actu" className="mt-16 scroll-mt-24">
          <header className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <Newspaper className="text-primary size-5" aria-hidden />
                Actu des sélections
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Les dernières actualités des équipes engagées à la Coupe du
                Monde 2026.
              </p>
            </div>
            <Link
              href="/coupe-du-monde-2026/actu"
              className="text-primary shrink-0 text-xs font-semibold hover:underline"
            >
              Toutes les actus →
            </Link>
          </header>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wcNews.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/coupe-du-monde-2026/actu/${n.slug ?? n.id}`}
                  className="bg-card hover:border-primary/40 border-border group flex h-full flex-col gap-3 rounded-2xl border p-4 transition-colors"
                >
                  <header className="flex items-center gap-2">
                    {n.team?.logo_url ? (
                      <div className="bg-muted relative size-7 shrink-0 overflow-hidden rounded-full">
                        <Image
                          src={n.team.logo_url}
                          alt=""
                          fill
                          sizes="28px"
                          className="object-contain p-1"
                        />
                      </div>
                    ) : (
                      <div className="bg-primary/15 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-xs">
                        🌍
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-primary truncate text-[10px] font-semibold tracking-widest uppercase">
                        {n.category === 'tournoi'
                          ? 'Tournoi'
                          : (n.team?.name ?? 'Sélection')}
                      </p>
                      <p className="text-muted-foreground text-[10px]">
                        {DATE_FMT.format(
                          new Date(n.published_at ?? n.scraped_at),
                        )}
                      </p>
                    </div>
                  </header>
                  <h3 className="group-hover:text-primary line-clamp-2 text-sm font-semibold leading-snug transition-colors">
                    {n.title}
                  </h3>
                  {n.ai_summary && (
                    <p className="text-muted-foreground mt-auto line-clamp-3 text-xs leading-relaxed">
                      {n.ai_summary}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* FAQ — contenu indexable + JSON-LD FAQPage pour les rich results */}
      <section id="faq" className="mt-16 scroll-mt-24">
        <header className="mb-6">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            Questions fréquentes
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            L&apos;essentiel à savoir sur la Coupe du Monde 2026.
          </p>
        </header>
        <FaqAccordion items={WC_FAQ} />
      </section>

      {/* Footer */}
      <section className="border-border mt-16 border-t pt-8 text-center text-xs">
        <p className="text-muted-foreground">
          Tu suis une équipe ?{' '}
          <Link
            href="/"
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
