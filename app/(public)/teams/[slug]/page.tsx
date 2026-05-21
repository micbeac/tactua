import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildSportsTeamJsonLd, JsonLd } from '@/components/seo/JsonLd';
import { TeamHeader } from '@/components/team/TeamHeader';
import {
  TeamMatchesList,
  type TeamMatchItem,
} from '@/components/team/TeamMatchesList';
import { FormationPitch } from '@/components/match/FormationPitch';
import {
  TeamNarrativesSection,
  type TeamNarrativeItem,
} from '@/components/team/TeamNarrativesSection';
import { TeamSeasonStats } from '@/components/team/TeamSeasonStats';
import { TeamSplitsSection } from '@/components/team/TeamSplitsSection';
import { TeamSquadSection } from '@/components/team/TeamSquadSection';
import {
  TeamStandingMini,
  type StandingTeam,
} from '@/components/team/TeamStandingMini';
import {
  getCompetitionStandings,
  getTeam,
  getTeamRecentMatches,
  getTeamSeasonStats,
  getTeamSquad,
  getTeamUpcomingMatches,
  type ScheduleMatch,
} from '@/lib/data/team';
import { getTeamSplits } from '@/lib/data/team-splits';
import { isFavorite } from '@/lib/data/favorites';
import { createClient } from '@/lib/supabase/server';
import { parseEntityId } from '@/lib/url';

export const revalidate = 60;

type TeamPageParams = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: TeamPageParams): Promise<Metadata> {
  const { slug } = await params;
  const id = parseEntityId(slug);
  if (id == null) return { title: 'Équipe introuvable' };
  const supabase = await createClient();
  const team = await getTeam(supabase, id);
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
  const { slug } = await params;
  const teamId = parseEntityId(slug);
  if (teamId == null) notFound();

  const supabase = await createClient();
  const team = await getTeam(supabase, teamId);
  if (!team) notFound();

  // Note : pas de redirect canonical (redirect + ISR posent problème sur Vercel).
  // Toutes nos balises <Link> génèrent déjà la version slug, donc la nav interne
  // affichera toujours l'URL propre. Seuls les accès directs à /teams/{id} pur
  // resteront sans slug — acceptable pour le MVP.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    seasonStatsRows,
    upcoming,
    recent,
    squad,
    favorite,
    narrativesRes,
    analysisRes,
    playerStatsRes,
    teamSplits,
  ] = await Promise.all([
    getTeamSeasonStats(supabase, teamId),
    getTeamUpcomingMatches(supabase, teamId, 5),
    getTeamRecentMatches(supabase, teamId, 5),
    getTeamSquad(supabase, teamId),
    isFavorite(supabase, user?.id ?? null, 'team', teamId),
    supabase
      .from('team_narratives')
      .select('title, url, snippet, scraped_at, slug, ai_summary')
      .eq('team_id', teamId)
      .order('scraped_at', { ascending: false })
      .limit(5),
    // Récupère la formation type via la dernière analyse impliquant l'équipe.
    // Pas besoin de colonne dédiée : rich_data.formation_home/away est déjà calculé
    // à chaque analyse pré-match et stocké dans match_analyses.content_json.
    supabase
      .from('match_analyses')
      .select(
        'content_json, generated_at, match:matches!inner(home_team_id, away_team_id)',
      )
      .eq('type', 'pre_match')
      .or(
        `home_team_id.eq.${teamId},away_team_id.eq.${teamId}`,
        { referencedTable: 'matches' },
      )
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Stats saison de tous les joueurs de l'équipe (toutes compétitions
    // confondues — agrégées côté JS). Permet d'afficher buts/passes dans le
    // popup joueur depuis la fiche équipe.
    supabase
      .from('player_season_stats')
      .select(
        'player_id, appearances, goals, assists, players!inner(current_team_id)',
      )
      .eq('players.current_team_id', teamId),
    getTeamSplits(supabase, teamId),
  ]);

  const narratives = (
    (narrativesRes.data ?? []) as Array<
      TeamNarrativeItem & { slug: string | null; ai_summary: string | null }
    >
  )
    .filter((n) => Boolean(n.title))
    .map((n) => ({
      ...n,
      internal_slug: n.slug,
      ai_summary: n.ai_summary,
    }));

  // Extrait la formation depuis l'analyse récente (côté correspondant à teamId)
  type AnalysisWithMatch = {
    content_json: {
      rich_data?: {
        formation_home: string | null;
        formation_away: string | null;
      };
    };
    match: {
      home_team_id: number;
      away_team_id: number;
    };
  };
  const analysisRow = analysisRes.data as unknown as AnalysisWithMatch | null;
  let teamFormation: string | null = null;
  if (analysisRow?.content_json?.rich_data) {
    teamFormation =
      analysisRow.match.home_team_id === teamId
        ? analysisRow.content_json.rich_data.formation_home
        : analysisRow.content_json.rich_data.formation_away;
  }

  // Agrège les stats saison par joueur (somme sur toutes les compétitions)
  type RawPlayerStatRow = {
    player_id: number;
    appearances: number | null;
    goals: number | null;
    assists: number | null;
  };
  const statsByPlayer = new Map<
    number,
    { player_id: number; appearances: number; goals: number; assists: number }
  >();
  for (const row of (playerStatsRes.data ?? []) as RawPlayerStatRow[]) {
    const existing = statsByPlayer.get(row.player_id);
    if (existing) {
      existing.appearances += row.appearances ?? 0;
      existing.goals += row.goals ?? 0;
      existing.assists += row.assists ?? 0;
    } else {
      statsByPlayer.set(row.player_id, {
        player_id: row.player_id,
        appearances: row.appearances ?? 0,
        goals: row.goals ?? 0,
        assists: row.assists ?? 0,
      });
    }
  }

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
      <JsonLd
        data={buildSportsTeamJsonLd({
          team_id: team.id,
          name: team.name,
          logo_url: team.logo_url,
          country: team.country,
          founded: team.founded,
          venue: team.venue,
        })}
      />
      <TeamHeader
        id={team.id}
        name={team.name}
        tla={team.tla}
        logo_url={team.logo_url}
        country={team.country}
        founded={team.founded}
        venue={team.venue}
        is_favorite={favorite}
        is_logged_in={Boolean(user)}
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

      <TeamSplitsSection splits={teamSplits} team_name={team.name} />

      <TeamNarrativesSection
        team_name={team.name}
        team_slug={slug}
        items={narratives}
      />

      {teamFormation && (
        <section className="bg-card border-border rounded-2xl border p-6">
          <h2 className="mb-4 text-base font-semibold">Formation type</h2>
          <div className="flex justify-center">
            <FormationPitch
              formation={teamFormation}
              team_name={team.name}
              variant="primary"
              width={260}
            />
          </div>
          <p className="text-muted-foreground/70 mt-3 text-center text-xs">
            Formation principale calculée sur les derniers matchs joués
          </p>
        </section>
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

      <TeamSquadSection
        players={squad}
        stats_by_player={statsByPlayer}
        team_name={team.name}
      />
    </main>
  );
}
