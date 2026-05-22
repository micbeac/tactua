import Link from 'next/link';
import { CompetitionAccordion } from '@/components/dashboard/CompetitionAccordion';
import { DailyRecapSection } from '@/components/dashboard/DailyRecapSection';
import { ForYouFeedSection } from '@/components/dashboard/ForYouFeedSection';
import { PlayerRecommendationsSection } from '@/components/dashboard/PlayerRecommendationsSection';
import {
  WatchlistSection,
  type WatchlistMatch,
} from '@/components/dashboard/WatchlistSection';
import { WeeklyRecapSection } from '@/components/dashboard/WeeklyRecapSection';
import { LandingCoverage } from '@/components/landing/LandingCoverage';
import { LandingDemo } from '@/components/landing/LandingDemo';
import { LandingFAQ } from '@/components/landing/LandingFAQ';
import { LandingFinalCta } from '@/components/landing/LandingFinalCta';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingHowItWorks } from '@/components/landing/LandingHowItWorks';
import { LandingLogoMarquee } from '@/components/landing/LandingLogoMarquee';
import { MatchCard, type MatchCardProps } from '@/components/match/MatchCard';
import { getPersonalUpcomingMatches, getUserFavorites } from '@/lib/data/favorites';
import { buildForYouFeed } from '@/lib/data/for-you-feed';
import { getDailyRecap } from '@/lib/data/recap';
import { getRecommendedPlayers } from '@/lib/data/recommendations';
import { getWeeklyRecap } from '@/lib/data/weekly-recap';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

// Compétitions affichées sur le dashboard, dans cet ordre.
// Chaque entrée a son propre header coloré + lien vers /competitions/[code].
const DASHBOARD_COMPETITIONS: Array<{
  id: number;
  code: string;
  label: string;
  flag: string;
  limit: number;
}> = [
  { id: 2000, code: 'wc', label: 'Coupe du Monde 2026', flag: '🌍', limit: 6 },
  { id: 2001, code: 'cl', label: 'Champions League', flag: '🇪🇺', limit: 4 },
  { id: 2021, code: 'pl', label: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', limit: 4 },
  { id: 2014, code: 'pd', label: 'La Liga', flag: '🇪🇸', limit: 4 },
  { id: 2019, code: 'sa', label: 'Serie A', flag: '🇮🇹', limit: 4 },
  { id: 2002, code: 'bl1', label: 'Bundesliga', flag: '🇩🇪', limit: 4 },
  { id: 2015, code: 'fl1', label: 'Ligue 1', flag: '🇫🇷', limit: 4 },
  { id: 9001, code: 'bjl', label: 'Jupiler Pro League', flag: '🇧🇪', limit: 4 },
];

type TeamEmbed = {
  id: number;
  name: string;
  tla: string | null;
  logo_url: string | null;
} | null;

type MatchRow = {
  id: number;
  kickoff_at: string;
  status: MatchCardProps['status'];
  stage: string | null;
  matchday: number | null;
  score_home: number | null;
  score_away: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team: TeamEmbed;
  away_team: TeamEmbed;
};

const SELECT_FRAGMENT = `
  id, kickoff_at, status, stage, matchday, score_home, score_away,
  home_team_id, away_team_id,
  home_team:teams!matches_home_team_id_fkey(id, name, tla, logo_url),
  away_team:teams!matches_away_team_id_fkey(id, name, tla, logo_url)
`;

function toCardProps(m: MatchRow): MatchCardProps {
  return {
    id: m.id,
    kickoff_at: m.kickoff_at,
    status: m.status,
    stage: m.stage,
    matchday: m.matchday,
    score_home: m.score_home,
    score_away: m.score_away,
    home: {
      id: m.home_team?.id ?? m.home_team_id,
      name: m.home_team?.name ?? 'À déterminer',
      tla: m.home_team?.tla ?? null,
      logo_url: m.home_team?.logo_url ?? null,
    },
    away: {
      id: m.away_team?.id ?? m.away_team_id,
      name: m.away_team?.name ?? 'À déterminer',
      tla: m.away_team?.tla ?? null,
      logo_url: m.away_team?.logo_url ?? null,
    },
  };
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Landing forcée en thème sombre (le design est conçu pour le dark).
    // `dark` redéfinit les CSS vars (--background, --foreground, --primary…)
    // pour tous les descendants, peu importe la préférence OS.
    return (
      <div
        className="dark bg-background text-foreground"
        style={{
          backgroundColor: 'oklch(0.16 0.025 255)',
          color: 'oklch(0.985 0 0)',
        }}
      >
        <LandingHero />
        <LandingLogoMarquee />
        <LandingDemo />
        <LandingHowItWorks />
        <LandingCoverage />
        <LandingFAQ />
        <LandingFinalCta />
      </div>
    );
  }

  // ============================================================================
  // Dashboard utilisateur connecté
  // ============================================================================
  const nowIso = new Date().toISOString();

  // Fetch les prochains matchs de chaque compétition en parallèle + favoris
  const competitionQueries = DASHBOARD_COMPETITIONS.map((c) =>
    supabase
      .from('matches')
      .select(SELECT_FRAGMENT)
      .eq('competition_id', c.id)
      .eq('status', 'scheduled')
      .gte('kickoff_at', nowIso)
      .order('kickoff_at', { ascending: true })
      .limit(c.limit),
  );

  const results = await Promise.all([
    ...competitionQueries,
    getPersonalUpcomingMatches(supabase, user.id, 8),
    getDailyRecap(supabase, user.id),
    getRecommendedPlayers(supabase, user.id, 8),
    getUserFavorites(supabase, user.id),
    getWeeklyRecap(supabase, user.id),
  ]);

  const personal = results[results.length - 5] as Awaited<
    ReturnType<typeof getPersonalUpcomingMatches>
  >;
  const recap = results[results.length - 4] as Awaited<
    ReturnType<typeof getDailyRecap>
  >;
  const recommendations = results[results.length - 3] as Awaited<
    ReturnType<typeof getRecommendedPlayers>
  >;
  const userFavs = results[results.length - 2] as Awaited<
    ReturnType<typeof getUserFavorites>
  >;
  const weeklyRecap = results[results.length - 1] as Awaited<
    ReturnType<typeof getWeeklyRecap>
  >;
  const favoriteTeamsCount = userFavs.filter(
    (f) => f.entity_type === 'team',
  ).length;

  const competitionMatches = DASHBOARD_COMPETITIONS.map((c, i) => ({
    ...c,
    matches: ((results[i] as { data: unknown }).data ?? []) as MatchRow[],
  }));

  // Prénom ou pseudonyme depuis email (avant le @)
  const userLabel = user.email?.split('@')[0] ?? null;

  // Feed "Pour toi" — mix des sources existantes (pas de nouvelle query)
  const feed = buildForYouFeed({
    personal,
    recap,
    weeklyRecap,
    recommendations,
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-10">
        <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
          Coupe du Monde 2026
        </p>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Tout ce qu&apos;il faut comprendre avant le match.
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Compositions, classements en direct et analyses tactiques générées par
          l&apos;IA. Suis tes équipes et joueurs préférés et reçois les notifs
          essentielles.
        </p>
        <div className="mt-4">
          <Link
            href="/calendrier"
            className="bg-primary/15 text-primary hover:bg-primary/25 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
          >
            <span>📅 Voir tous les matchs du jour</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* Récap quotidien — tuiles + résultats favoris hier + news fraîches */}
      <DailyRecapSection recap={recap} user_label={userLabel} />

      {/* Récap hebdomadaire — bilan 7 derniers jours des favoris */}
      <WeeklyRecapSection recap={weeklyRecap} />

      {/* Feed "Pour toi" — mix personnalisé matchs/résultats/news/suggestions */}
      <ForYouFeedSection items={feed} />

      {/* Watchlist : favoris avec countdown live + bouton "Analyser" */}
      <WatchlistSection
        matches={personal.map(
          (m): WatchlistMatch => ({
            id: m.id,
            kickoff_at: m.kickoff_at,
            status: m.status,
            stage: m.stage,
            matchday: m.matchday,
            score_home: m.score_home,
            score_away: m.score_away,
            competition_name: m.competition?.name ?? null,
            home: {
              id: m.home_team?.id ?? m.home_team_id,
              name: m.home_team?.name ?? 'À déterminer',
              tla: m.home_team?.tla ?? null,
              logo_url: m.home_team?.logo_url ?? null,
            },
            away: {
              id: m.away_team?.id ?? m.away_team_id,
              name: m.away_team?.name ?? 'À déterminer',
              tla: m.away_team?.tla ?? null,
              logo_url: m.away_team?.logo_url ?? null,
            },
          }),
        )}
      />

      {/* Recommandations joueurs basées sur les équipes favorites */}
      <PlayerRecommendationsSection
        players={recommendations}
        favorite_teams_count={favoriteTeamsCount}
      />

      {/* Une section accordéon par compétition trackée — repliable, état persisté */}
      <div className="space-y-3">
        {competitionMatches.map((c) => (
          <CompetitionAccordion
            key={c.id}
            code={c.code}
            label={c.label}
            flag={c.flag}
            matches={c.matches.map(toCardProps)}
            default_open={false}
          />
        ))}
      </div>
    </main>
  );
}
