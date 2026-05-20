import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompetitionMatchList } from '@/components/competition/CompetitionMatchList';
import {
  TeamStandingMini,
  type StandingTeam,
} from '@/components/team/TeamStandingMini';
import {
  getCompetitionByCode,
  getCompetitionRecentMatches,
  getCompetitionUpcomingMatches,
} from '@/lib/data/competition';
import { getCompetitionStandings } from '@/lib/data/team';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

type CompetitionPageParams = { params: Promise<{ code: string }> };

export async function generateMetadata({
  params,
}: CompetitionPageParams): Promise<Metadata> {
  const { code } = await params;
  const supabase = await createClient();
  const comp = await getCompetitionByCode(supabase, code);
  if (!comp) return { title: 'Compétition introuvable' };
  return {
    title: comp.name,
    description: `${comp.name} · matchs, classement, statistiques.`,
  };
}

export default async function CompetitionPage({
  params,
}: CompetitionPageParams) {
  const { code } = await params;
  const supabase = await createClient();
  const comp = await getCompetitionByCode(supabase, code);
  if (!comp) notFound();

  const season = comp.current_season ?? '';

  const [upcoming, recent, standingsRaw] = await Promise.all([
    getCompetitionUpcomingMatches(supabase, comp.id, 50),
    getCompetitionRecentMatches(supabase, comp.id, 20),
    season
      ? getCompetitionStandings(supabase, comp.id, season)
      : Promise.resolve([]),
  ]);

  const standingRows: StandingTeam[] = standingsRaw.map((r) => ({
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

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <header>
        <p className="text-primary mb-1 text-xs font-semibold tracking-widest uppercase">
          Compétition
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {comp.name}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {comp.country ? `${comp.country} · ` : ''}
          {season ? `Saison ${season}` : 'Saison en cours'}
        </p>
      </header>

      <CompetitionMatchList
        title="Prochains matchs"
        empty_label="Aucun match à venir programmé."
        matches={upcoming}
      />

      {standingRows.length > 0 && (
        <TeamStandingMini
          competition_name={comp.name}
          highlight_team_id={-1}
          rows={standingRows}
        />
      )}

      <CompetitionMatchList
        title="Résultats récents"
        empty_label="Aucun match joué récemment."
        matches={recent}
      />
    </main>
  );
}
