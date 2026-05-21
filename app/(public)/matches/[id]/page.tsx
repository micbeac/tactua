import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MatchAnalysisOnDemand } from '@/components/match/MatchAnalysisOnDemand';
import { MatchFormSection } from '@/components/match/MatchFormSection';
import { MatchH2HSection } from '@/components/match/MatchH2HSection';
import { MatchHeader } from '@/components/match/MatchHeader';
import { MatchInfoCard } from '@/components/match/MatchInfoCard';
import {
  MatchLineupSection,
  type TeamLineup,
} from '@/components/match/MatchLineupSection';
import { MatchStatsSection } from '@/components/match/MatchStatsSection';
import { buildSportsEventJsonLd, JsonLd } from '@/components/seo/JsonLd';
import { getAnalysis } from '@/lib/data/analysis';
import { isFavorite } from '@/lib/data/favorites';
import {
  getHeadToHead,
  getMatchTeamStats,
  getTeamForm,
} from '@/lib/data/match';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type {
  DeepPreMatchAnalysis,
  PostMatchAnalysis,
  PreMatchAnalysis,
} from '@/lib/openai/types';

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

  const supabase = await createClient();
  const homeId = match.home_team?.id ?? match.home_team_id;
  const awayId = match.away_team?.id ?? match.away_team_id;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    h2h,
    formHome,
    formAway,
    teamStats,
    favorite,
    preAnalysis,
    postAnalysis,
  ] = await Promise.all([
    homeId != null && awayId != null
      ? getHeadToHead(supabase, homeId, awayId, matchId, 5)
      : Promise.resolve([]),
    homeId != null
      ? getTeamForm(supabase, homeId, matchId, 5)
      : Promise.resolve([]),
    awayId != null
      ? getTeamForm(supabase, awayId, matchId, 5)
      : Promise.resolve([]),
    getMatchTeamStats(supabase, matchId),
    isFavorite(supabase, user?.id ?? null, 'match', matchId),
    getAnalysis(supabase, matchId, 'pre_match'),
    getAnalysis(supabase, matchId, 'post_match'),
  ]);

  const homeStats = teamStats.find((s) => s.team_id === homeId) ?? null;
  const awayStats = teamStats.find((s) => s.team_id === awayId) ?? null;
  const showStats = match.status === 'live' || match.status === 'finished';

  // Tracking passif : log un "viewed" si user logged-in et qu'une analyse existe.
  // Throttle : un seul event "viewed" par user/match/type/jour (anti-spam).
  // Le write passe par admin client (table protégée par RLS write).
  if (user && (preAnalysis || postAnalysis)) {
    const admin = createAdminClient();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const toLog: Array<{ analysis_type: 'pre_match' | 'post_match' }> = [];
    if (preAnalysis) toLog.push({ analysis_type: 'pre_match' });
    if (postAnalysis) toLog.push({ analysis_type: 'post_match' });

    await Promise.all(
      toLog.map(async ({ analysis_type }) => {
        const { data: recent } = await admin
          .from('user_match_analysis_events')
          .select('id')
          .eq('user_id', user.id)
          .eq('match_id', matchId)
          .eq('analysis_type', analysis_type)
          .gte('at', oneDayAgo)
          .limit(1);
        if ((recent ?? []).length === 0) {
          await admin.from('user_match_analysis_events').insert({
            user_id: user.id,
            match_id: matchId,
            analysis_type,
            action: 'viewed',
          });
        }
      }),
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <JsonLd
        data={buildSportsEventJsonLd({
          match_id: match.id,
          home: match.home_team
            ? {
                id: match.home_team.id,
                name: match.home_team.name,
                logo_url: match.home_team.logo_url,
              }
            : null,
          away: match.away_team
            ? {
                id: match.away_team.id,
                name: match.away_team.name,
                logo_url: match.away_team.logo_url,
              }
            : null,
          competition_name: match.competition?.name ?? null,
          kickoff_at_iso: match.kickoff_at,
          venue: match.venue,
          status: match.status,
        })}
      />
      <MatchHeader
        id={match.id}
        kickoff_at={match.kickoff_at}
        status={match.status}
        stage={match.stage}
        matchday={match.matchday}
        score_home={match.score_home}
        score_away={match.score_away}
        is_favorite={favorite}
        is_logged_in={Boolean(user)}
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

      <div id="analyse" className="scroll-mt-24" />

      {match.status === 'finished' && (
        <MatchAnalysisOnDemand
          match_id={match.id}
          type="post_match"
          is_logged_in={Boolean(user)}
          home_team_name={match.home_team?.name ?? 'Domicile'}
          away_team_name={match.away_team?.name ?? 'Extérieur'}
          initial_analysis={
            (postAnalysis?.content_json as PostMatchAnalysis | undefined) ??
            null
          }
          initial_generated_at={postAnalysis?.generated_at ?? null}
        />
      )}

      {(match.status === 'scheduled' ||
        match.status === 'live' ||
        match.status === 'finished') && (
        <MatchAnalysisOnDemand
          match_id={match.id}
          type="pre_match"
          is_logged_in={Boolean(user)}
          home_team_name={match.home_team?.name ?? 'Domicile'}
          away_team_name={match.away_team?.name ?? 'Extérieur'}
          initial_analysis={
            (preAnalysis?.content_json as
              | PreMatchAnalysis
              | DeepPreMatchAnalysis
              | undefined) ?? null
          }
          initial_generated_at={preAnalysis?.generated_at ?? null}
        />
      )}

      <MatchLineupSection
        is_confirmed={anyConfirmed}
        home={buildTeamLineup(match.home_team, lineupRows)}
        away={buildTeamLineup(match.away_team, lineupRows)}
      />

      <MatchFormSection
        home={{
          team_id: homeId,
          team_name: match.home_team?.name ?? 'À déterminer',
          matches: formHome,
        }}
        away={{
          team_id: awayId,
          team_name: match.away_team?.name ?? 'À déterminer',
          matches: formAway,
        }}
      />

      <MatchH2HSection
        teamA={{
          id: homeId,
          name: match.home_team?.name ?? 'À déterminer',
        }}
        teamB={{
          id: awayId,
          name: match.away_team?.name ?? 'À déterminer',
        }}
        matches={h2h.map((m) => ({
          id: m.id,
          kickoff_at: m.kickoff_at,
          competition_name: m.competition?.name ?? null,
          home_team_id: m.home_team_id,
          away_team_id: m.away_team_id,
          score_home: m.score_home,
          score_away: m.score_away,
        }))}
      />

      {showStats && (
        <MatchStatsSection
          home={{
            team_id: homeId,
            team_name: match.home_team?.name ?? 'Domicile',
          }}
          away={{
            team_id: awayId,
            team_name: match.away_team?.name ?? 'Extérieur',
          }}
          home_stats={homeStats}
          away_stats={awayStats}
        />
      )}
    </main>
  );
}
