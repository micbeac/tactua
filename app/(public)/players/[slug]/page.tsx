import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { PlayerHeader } from '@/components/player/PlayerHeader';
import {
  PlayerRecentPerformances,
  type PerformanceItem,
} from '@/components/player/PlayerRecentPerformances';
import {
  PlayerSeasonStatsCard,
  type PlayerSeasonStats,
} from '@/components/player/PlayerSeasonStatsCard';
import {
  getPlayer,
  getPlayerRecentPerformances,
  getPlayerSeasonStats,
} from '@/lib/data/player';
import { createClient } from '@/lib/supabase/server';
import { parseEntityId, playerHref } from '@/lib/url';

export const revalidate = 60;

type PlayerPageParams = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PlayerPageParams): Promise<Metadata> {
  const { slug } = await params;
  const id = parseEntityId(slug);
  if (id == null) return { title: 'Joueur introuvable' };
  const supabase = await createClient();
  const player = await getPlayer(supabase, id);
  if (!player) return { title: 'Joueur introuvable' };
  const club = player.current_team?.name;
  return {
    title: player.name,
    description: `${player.name}${player.position ? ` · ${player.position}` : ''}${
      club ? ` · ${club}` : ''
    }. Stats saison et dernières performances.`,
  };
}

export default async function PlayerPage({ params }: PlayerPageParams) {
  const { slug } = await params;
  const playerId = parseEntityId(slug);
  if (playerId == null) notFound();

  const supabase = await createClient();
  const player = await getPlayer(supabase, playerId);
  if (!player) notFound();

  const canonical = playerHref(player.id, player.name);
  if (`/players/${slug}` !== canonical) {
    permanentRedirect(canonical);
  }

  const [seasonStatsRaw, performancesRaw] = await Promise.all([
    getPlayerSeasonStats(supabase, playerId),
    getPlayerRecentPerformances(supabase, playerId, 5),
  ]);

  const seasonStats: PlayerSeasonStats[] = seasonStatsRaw.map((s) => ({
    season: s.season,
    competition_name: s.competition?.name ?? null,
    appearances: s.appearances,
    minutes: s.minutes,
    goals: s.goals,
    assists: s.assists,
    yellow_cards: s.yellow_cards,
    red_cards: s.red_cards,
  }));

  const playerTeamId = player.current_team_id;
  const performances: PerformanceItem[] = performancesRaw.map((p) => {
    const m = p.match;
    if (!m) {
      return {
        match_id: p.match_id,
        kickoff_at: null,
        competition_name: null,
        opponent_name: null,
        was_home: null,
        team_score: null,
        opponent_score: null,
        minutes_played: p.minutes_played,
        goals: p.goals,
        assists: p.assists,
        rating: p.rating,
      };
    }
    const wasHome =
      playerTeamId != null && m.home_team_id === playerTeamId ? true : false;
    const opponent = wasHome ? m.away_team : m.home_team;
    const teamScore = wasHome ? m.score_home : m.score_away;
    const opponentScore = wasHome ? m.score_away : m.score_home;
    return {
      match_id: p.match_id,
      kickoff_at: m.kickoff_at,
      competition_name: m.competition?.name ?? null,
      opponent_name: opponent?.name ?? null,
      was_home: wasHome,
      team_score: teamScore,
      opponent_score: opponentScore,
      minutes_played: p.minutes_played,
      goals: p.goals,
      assists: p.assists,
      rating: p.rating,
    };
  });

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <PlayerHeader
        name={player.name}
        position={player.position}
        nationality={player.nationality}
        date_of_birth={player.date_of_birth}
        current_team={
          player.current_team
            ? {
                id: player.current_team.id,
                name: player.current_team.name,
                logo_url: player.current_team.logo_url,
                country: player.current_team.country,
              }
            : null
        }
      />

      <PlayerSeasonStatsCard stats={seasonStats} />

      <PlayerRecentPerformances items={performances} />
    </main>
  );
}
