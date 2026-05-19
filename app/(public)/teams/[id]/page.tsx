import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TeamHeader } from '@/components/team/TeamHeader';
import {
  TeamMatchesList,
  type TeamMatchItem,
} from '@/components/team/TeamMatchesList';
import { TeamSeasonStats } from '@/components/team/TeamSeasonStats';
import {
  TeamStandingMini,
  type StandingTeam,
} from '@/components/team/TeamStandingMini';
import {
  getCompetitionStandings,
  getTeam,
  getTeamRecentMatches,
  getTeamSeasonStats,
  getTeamUpcomingMatches,
  type ScheduleMatch,
} from '@/lib/data/team';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

type TeamPageParams = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: TeamPageParams): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const team = await getTeam(supabase, Number(id));
  if (!team) return { title: 'Équipe introuvable' };
  return {
    title: team.name,
    description: `${team.name} · prochains matchs, résultats récents, classement et stats saison.`,
  };
}

function toMatchItem(teamId: number, m: ScheduleMatch): TeamMatchItem {
  return {
    id: m.id,
    kickoff_at: m.kickoff_at,
    status: m.status,
    score_home: m.score_home,
    score_away: m.score_away,
    team_id: teamId,
    home_team_id: m.home_team_id,
    away_team_id: m.away_team_id,
    competition_name: m.competition?.name ?? null,
    opponent: m.opponent,
  };
}

export default async function TeamPage({ params }: TeamPageParams) {
  const { id } = await params;
  const teamId = Number(id);
  if (!Number.isFinite(teamId)) notFound();

  const supabase = await createClient();
  const team = await getTeam(supabase, teamId);
  if (!team) notFound();

  const [seasonStatsRows, upcoming, recent] = await Promise.all([
    getTeamSeasonStats(supabase, teamId),
    getTeamUpcomingMatches(supabase, teamId, 5),
    getTeamRecentMatches(supabase, teamId, 5),
  ]);

  // Compétition principale : la 1re du tri (points DESC, position ASC).
  const main = seasonStatsRows[0] ?? null;

  // Pour la mini-table de classement, on prend la compétition principale
  // et on garde le top 10 + l'équipe (au cas où elle est en bas).
  let standingRows: StandingTeam[] = [];
  let standingCompetitionName = '';
  if (main?.competition) {
    const all = await getCompetitionStandings(
      supabase,
      main.competition.id,
      main.season,
    );
    const top10 = all.slice(0, 10);
    const selfRow = all.find((r) => r.team_id === teamId);
    const includesSelf = top10.some((r) => r.team_id === teamId);
    const merged = includesSelf || !selfRow ? top10 : [...top10, selfRow];

    standingRows = merged.map((r) => ({
      team_id: r.team_id,
      position: r.position,
      played: r.played,
      wins: r.wins,
      draws: r.draws,
      losses: r.losses,
      goals_for: r.goals_for,
      goals_against: r.goals_against,
      goal_difference: r.goal_difference,
      points: r.points,
      team_name: r.team?.name ?? '—',
      team_logo: r.team?.logo_url ?? null,
      team_tla: r.team?.tla ?? null,
    }));
    standingCompetitionName = main.competition.name;
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <TeamHeader
        name={team.name}
        tla={team.tla}
        logo_url={team.logo_url}
        country={team.country}
        founded={team.founded}
        venue={team.venue}
      />

      {main && (
        <TeamSeasonStats
          competition_name={main.competition?.name ?? null}
          season={main.season}
          position={main.position}
          played={main.played}
          wins={main.wins}
          draws={main.draws}
          losses={main.losses}
          goals_for={main.goals_for}
          goals_against={main.goals_against}
          goal_difference={main.goal_difference}
          points={main.points}
        />
      )}

      {standingRows.length > 0 && (
        <TeamStandingMini
          competition_name={standingCompetitionName}
          highlight_team_id={teamId}
          rows={standingRows}
        />
      )}

      <TeamMatchesList
        title="Prochains matchs"
        empty_label="Aucun match programmé prochainement."
        matches={upcoming.map((m) => toMatchItem(teamId, m))}
      />

      <TeamMatchesList
        title="Derniers résultats"
        empty_label="Aucun match joué récemment."
        matches={recent.map((m) => toMatchItem(teamId, m))}
      />
    </main>
  );
}
