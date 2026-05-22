import { CompetitionAccordion } from '@/components/dashboard/CompetitionAccordion';
import { DailyRecapSection } from '@/components/dashboard/DailyRecapSection';
import { MatchesOfDaySection } from '@/components/dashboard/MatchesOfDaySection';
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
import { type MatchCardProps } from '@/components/match/MatchCard';
import { getPersonalUpcomingMatches } from '@/lib/data/favorites';
import { getDailyRecap } from '@/lib/data/recap';
import { getWeeklyRecap } from '@/lib/data/weekly-recap';
import { getMatchesForDay, todayParis } from '@/lib/matchday';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

// Compétitions affichées sur le dashboard, dans cet ordre.
// Chaque entrée a son propre header coloré + lien vers /competitions/[code].
//
// mode :
//  - 'matchday' → affiche la prochaine journée = tous les matchs dans une
//    fenêtre de 4 jours à partir du prochain match (le champ `matchday`
//    est parfois null/incohérent selon la source, on ne s'y fie pas).
//  - 'limit'    → plafond fixe (CDM : une « journée » de poule = 24 matchs).
const DASHBOARD_COMPETITIONS: Array<{
  id: number;
  code: string;
  label: string;
  flag: string;
  mode: 'matchday' | 'limit';
  limit: number;
}> = [
  { id: 2000, code: 'wc', label: 'Coupe du Monde 2026', flag: '🌍', mode: 'limit', limit: 8 },
  { id: 2001, code: 'cl', label: 'Champions League', flag: '🇪🇺', mode: 'matchday', limit: 6 },
  { id: 2021, code: 'pl', label: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', mode: 'matchday', limit: 6 },
  { id: 2014, code: 'pd', label: 'La Liga', flag: '🇪🇸', mode: 'matchday', limit: 6 },
  { id: 2019, code: 'sa', label: 'Serie A', flag: '🇮🇹', mode: 'matchday', limit: 6 },
  { id: 2002, code: 'bl1', label: 'Bundesliga', flag: '🇩🇪', mode: 'matchday', limit: 6 },
  { id: 2015, code: 'fl1', label: 'Ligue 1', flag: '🇫🇷', mode: 'matchday', limit: 6 },
  { id: 9001, code: 'bjl', label: 'Jupiler Pro League', flag: '🇧🇪', mode: 'matchday', limit: 6 },
];

// Fenêtre (en ms) considérée comme « une journée » : tous les matchs dont
// le coup d'envoi tombe dans les 4 jours suivant le prochain match.
const MATCHDAY_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;
// Plafond de sécurité : une journée ne dépasse jamais ~12 matchs.
const MATCHDAY_HARD_CAP = 14;

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
  const today = todayParis();

  // Fetch les prochains matchs de chaque compétition en parallèle.
  // On récupère large (30) puis on découpe côté JS : soit la prochaine
  // journée complète (mode 'matchday'), soit un plafond fixe (mode 'limit').
  const competitionQueries = DASHBOARD_COMPETITIONS.map((c) =>
    supabase
      .from('matches')
      .select(SELECT_FRAGMENT)
      .eq('competition_id', c.id)
      .eq('status', 'scheduled')
      .gte('kickoff_at', nowIso)
      .order('kickoff_at', { ascending: true })
      .limit(30),
  );

  const results = await Promise.all([
    ...competitionQueries,
    getPersonalUpcomingMatches(supabase, user.id, 8),
    getDailyRecap(supabase, user.id),
    getWeeklyRecap(supabase, user.id),
    getMatchesForDay(supabase, today),
  ]);

  const personal = results[results.length - 4] as Awaited<
    ReturnType<typeof getPersonalUpcomingMatches>
  >;
  const recap = results[results.length - 3] as Awaited<
    ReturnType<typeof getDailyRecap>
  >;
  const weeklyRecap = results[results.length - 2] as Awaited<
    ReturnType<typeof getWeeklyRecap>
  >;
  const todayGroups = results[results.length - 1] as Awaited<
    ReturnType<typeof getMatchesForDay>
  >;

  const competitionMatches = DASHBOARD_COMPETITIONS.map((c, i) => {
    const all = ((results[i] as { data: unknown }).data ?? []) as MatchRow[];
    let matches: MatchRow[];
    if (c.mode === 'limit') {
      matches = all.slice(0, c.limit);
    } else {
      // mode 'matchday' : tous les matchs dans les 4 jours suivant le
      // prochain match (= la prochaine journée), sans dépendre du champ
      // matchday souvent incohérent.
      const first = all[0];
      if (!first) {
        matches = [];
      } else {
        const windowEnd =
          new Date(first.kickoff_at).getTime() + MATCHDAY_WINDOW_MS;
        matches = all
          .filter((m) => new Date(m.kickoff_at).getTime() <= windowEnd)
          .slice(0, MATCHDAY_HARD_CAP);
      }
    }
    return { ...c, matches };
  });

  // Prénom ou pseudonyme depuis email (avant le @)
  const userLabel = user.email?.split('@')[0] ?? null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-6">
        <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
          Coupe du Monde 2026
        </p>
        <h1 className="mb-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Tout ce qu&apos;il faut comprendre avant le match.
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Compositions, classements en direct et analyses tactiques générées par
          l&apos;IA. Suis tes équipes et joueurs préférés et reçois les notifs
          essentielles.
        </p>
      </section>

      {/* Matchs du jour — vue d'ensemble, navigation par jour, scores live */}
      <MatchesOfDaySection
        initial_date={today}
        initial_groups={todayGroups}
        today={today}
      />

      {/* Récap quotidien — tuiles + résultats favoris hier + news fraîches */}
      <DailyRecapSection recap={recap} user_label={userLabel} />

      {/* Récap hebdomadaire — bilan 7 derniers jours des favoris */}
      <WeeklyRecapSection recap={weeklyRecap} />

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
