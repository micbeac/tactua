import Link from 'next/link';
import { LandingCoverage } from '@/components/landing/LandingCoverage';
import { LandingDemo } from '@/components/landing/LandingDemo';
import { LandingFAQ } from '@/components/landing/LandingFAQ';
import { LandingFinalCta } from '@/components/landing/LandingFinalCta';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingHowItWorks } from '@/components/landing/LandingHowItWorks';
import { LandingLogoMarquee } from '@/components/landing/LandingLogoMarquee';
import { MatchCard, type MatchCardProps } from '@/components/match/MatchCard';
import { WorldCupCountdown } from '@/components/shared/WorldCupCountdown';
import { getPersonalUpcomingMatches } from '@/lib/data/favorites';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

const WC_COMPETITION_ID = 2000;
const TOP5_COMPETITION_IDS = [
  2021, // Premier League
  2014, // La Liga
  2002, // Bundesliga
  2019, // Serie A
  2015, // Ligue 1
];
const JPL_COMPETITION_ID = 9001; // Jupiler Pro League

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
    // Le style inline garantit la couleur de fond même si une extension
    // navigateur tente d'imposer un autre thème.
    return (
      <div
        className="dark bg-background text-foreground"
        style={{
          // Dark navy explicite — équivalent oklch(0.16 0.025 255).
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

  // === Dashboard utilisateur connecté ===
  const [wcRes, top5Res, jplRes, personal] = await Promise.all([
    supabase
      .from('matches')
      .select(SELECT_FRAGMENT)
      .eq('competition_id', WC_COMPETITION_ID)
      .eq('status', 'scheduled')
      .gte('kickoff_at', new Date().toISOString())
      .order('kickoff_at', { ascending: true })
      .limit(10),
    supabase
      .from('matches')
      .select(SELECT_FRAGMENT)
      .in('competition_id', TOP5_COMPETITION_IDS)
      .eq('status', 'scheduled')
      .gte('kickoff_at', new Date().toISOString())
      .order('kickoff_at', { ascending: true })
      .limit(6),
    supabase
      .from('matches')
      .select(SELECT_FRAGMENT)
      .eq('competition_id', JPL_COMPETITION_ID)
      .eq('status', 'scheduled')
      .gte('kickoff_at', new Date().toISOString())
      .order('kickoff_at', { ascending: true })
      .limit(6),
    getPersonalUpcomingMatches(supabase, user.id, 8),
  ]);

  const wcMatches = (wcRes.data ?? []) as unknown as MatchRow[];
  const top5Matches = (top5Res.data ?? []) as unknown as MatchRow[];
  const jplMatches = (jplRes.data ?? []) as unknown as MatchRow[];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-10">
        <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
          Coupe du Monde 2026
        </p>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Tout ce qu&apos;il faut comprendre avant le match.
        </h1>
        <WorldCupCountdown />
        <p className="text-muted-foreground mt-5 max-w-2xl text-sm">
          Compositions, classements en direct et analyses tactiques générées par
          l&apos;IA. Suis tes équipes et joueurs préférés et reçois les notifs
          essentielles.
        </p>
      </section>

      {personal.length > 0 && (
        <section className="mb-12">
          <header className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-semibold">
              <span className="text-primary">★</span> Tes matchs
            </h2>
            <Link
              href="/favoris"
              className="text-muted-foreground hover:text-foreground text-xs underline"
            >
              Gérer mes favoris
            </Link>
          </header>
          <div className="grid gap-3 sm:grid-cols-2">
            {personal.map((m) => (
              <MatchCard
                key={m.id}
                id={m.id}
                kickoff_at={m.kickoff_at}
                status={m.status}
                stage={m.stage}
                matchday={m.matchday}
                score_home={m.score_home}
                score_away={m.score_away}
                home={{
                  id: m.home_team?.id ?? m.home_team_id,
                  name: m.home_team?.name ?? 'À déterminer',
                  tla: m.home_team?.tla ?? null,
                  logo_url: m.home_team?.logo_url ?? null,
                }}
                away={{
                  id: m.away_team?.id ?? m.away_team_id,
                  name: m.away_team?.name ?? 'À déterminer',
                  tla: m.away_team?.tla ?? null,
                  logo_url: m.away_team?.logo_url ?? null,
                }}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mb-12">
        <header className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-semibold">Prochains matchs CDM</h2>
          <Link
            href={`/competitions/wc`}
            className="text-muted-foreground hover:text-foreground text-xs underline"
          >
            Voir tout
          </Link>
        </header>
        {wcMatches.length === 0 ? (
          <EmptyState label="Aucun match CDM programmé pour l'instant." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {wcMatches.map((m) => (
              <MatchCard key={m.id} {...toCardProps(m)} />
            ))}
          </div>
        )}
      </section>

      <section className="mb-12">
        <header className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-semibold">
            Top 5 européen — Prochains matchs
          </h2>
        </header>
        {top5Matches.length === 0 ? (
          <EmptyState label="Aucun match à venir dans le top 5 européen." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {top5Matches.map((m) => (
              <MatchCard key={m.id} {...toCardProps(m)} />
            ))}
          </div>
        )}
      </section>

      <section className="mb-12">
        <header className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-semibold">
            🇧🇪 Jupiler Pro League — Prochains matchs
          </h2>
          <Link
            href="/competitions/bjl"
            className="text-muted-foreground hover:text-foreground text-xs underline"
          >
            Voir tout
          </Link>
        </header>
        {jplMatches.length === 0 ? (
          <EmptyState label="Aucun match Jupiler Pro League à venir." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {jplMatches.map((m) => (
              <MatchCard key={m.id} {...toCardProps(m)} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="bg-card text-muted-foreground border-border rounded-xl border p-6 text-center text-sm">
      {label}
    </div>
  );
}
