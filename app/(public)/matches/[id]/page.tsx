import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MatchHeader } from '@/components/match/MatchHeader';
import { MatchInfoCard } from '@/components/match/MatchInfoCard';
import {
  MatchLineupSection,
  type TeamLineup,
} from '@/components/match/MatchLineupSection';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

type MatchPageParams = { params: Promise<{ id: string }> };

type TeamEmbed = {
  id: number;
  name: string;
  tla: string | null;
  logo_url: string | null;
};

type CompetitionEmbed = {
  id: number;
  name: string;
  country: string | null;
};

type MatchRow = {
  id: number;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  stage: string | null;
  matchday: number | null;
  score_home: number | null;
  score_away: number | null;
  venue: string | null;
  referee: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  competition: CompetitionEmbed | null;
  home_team: TeamEmbed | null;
  away_team: TeamEmbed | null;
};

const MATCH_SELECT = `
  id, kickoff_at, status, stage, matchday, score_home, score_away,
  venue, referee, home_team_id, away_team_id,
  competition:competitions(id, name, country),
  home_team:teams!matches_home_team_id_fkey(id, name, tla, logo_url),
  away_team:teams!matches_away_team_id_fkey(id, name, tla, logo_url)
`;

async function getMatch(id: number): Promise<MatchRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[match page] query error', error);
    return null;
  }
  return (data as unknown as MatchRow | null) ?? null;
}

type LineupRow = {
  team_id: number;
  player_id: number;
  position: string | null;
  shirt_number: number | null;
  is_starter: boolean;
  is_confirmed: boolean;
  players: { id: number; name: string } | null;
};

async function getLineups(matchId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('match_lineups')
    .select(
      'team_id, player_id, position, shirt_number, is_starter, is_confirmed, players(id, name)',
    )
    .eq('match_id', matchId);
  if (error) {
    console.error('[match page] lineups query error', error);
    return [] as LineupRow[];
  }
  return (data ?? []) as unknown as LineupRow[];
}

function buildTeamLineup(
  team: TeamEmbed | null,
  rows: LineupRow[],
): TeamLineup | null {
  if (!team) return null;
  const teamRows = rows.filter((r) => r.team_id === team.id);
  return {
    team_id: team.id,
    team_name: team.name,
    team_logo: team.logo_url,
    starters: teamRows
      .filter((r) => r.is_starter)
      .sort((a, b) => (a.shirt_number ?? 99) - (b.shirt_number ?? 99))
      .map((r) => ({
        player_id: r.player_id,
        player_name: r.players?.name ?? null,
        position: r.position,
        shirt_number: r.shirt_number,
      })),
    bench: teamRows
      .filter((r) => !r.is_starter)
      .sort((a, b) => (a.shirt_number ?? 99) - (b.shirt_number ?? 99))
      .map((r) => ({
        player_id: r.player_id,
        player_name: r.players?.name ?? null,
        position: r.position,
        shirt_number: r.shirt_number,
      })),
  };
}

export async function generateMetadata({
  params,
}: MatchPageParams): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatch(Number(id));
  if (!match) return { title: 'Match introuvable' };
  const home = match.home_team?.name ?? 'Équipe à venir';
  const away = match.away_team?.name ?? 'Équipe à venir';
  const competition = match.competition?.name ?? 'Football';
  return {
    title: `${home} vs ${away}`,
    description: `${home} contre ${away} en ${competition}. Compositions, score, analyse tactique IA.`,
  };
}

export default async function MatchPage({ params }: MatchPageParams) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isFinite(matchId)) notFound();

  const match = await getMatch(matchId);
  if (!match) notFound();

  const lineupRows = await getLineups(matchId);
  const anyConfirmed = lineupRows.some((r) => r.is_confirmed);

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <MatchHeader
        kickoff_at={match.kickoff_at}
        status={match.status}
        stage={match.stage}
        matchday={match.matchday}
        score_home={match.score_home}
        score_away={match.score_away}
        home={{
          id: match.home_team?.id ?? match.home_team_id,
          name: match.home_team?.name ?? 'À déterminer',
          tla: match.home_team?.tla ?? null,
          logo_url: match.home_team?.logo_url ?? null,
        }}
        away={{
          id: match.away_team?.id ?? match.away_team_id,
          name: match.away_team?.name ?? 'À déterminer',
          tla: match.away_team?.tla ?? null,
          logo_url: match.away_team?.logo_url ?? null,
        }}
      />

      <MatchInfoCard
        competition_name={match.competition?.name ?? null}
        competition_country={match.competition?.country ?? null}
        stage={match.stage}
        matchday={match.matchday}
        venue={match.venue}
        referee={match.referee}
      />

      <MatchLineupSection
        is_confirmed={anyConfirmed}
        home={buildTeamLineup(match.home_team, lineupRows)}
        away={buildTeamLineup(match.away_team, lineupRows)}
      />
    </main>
  );
}
