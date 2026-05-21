// Construction du DeepTeamContext pour generateDeepPreMatchAnalysis.
// Charge en parallèle : team stats, top performers, injuries via API-Football.

import {
  fetchActiveInjuries,
  fetchTeamStats,
  fetchTopPerformers,
} from './deep-stats.ts';
import type { DeepTeamContext } from '@/lib/openai/analyses';

export type BuildDeepTeamContextInput = {
  af_team_id: number;
  af_league_id: number;
  season: number;
  team_name: string;
  team_country: string | null;
  starting_eleven: string[];
  match_date: Date;
};

export async function buildDeepTeamContext(
  input: BuildDeepTeamContextInput,
): Promise<DeepTeamContext> {
  const { af_team_id, af_league_id, season, team_name, team_country } = input;

  const [stats, top, injuries] = await Promise.all([
    fetchTeamStats(af_team_id, af_league_id, season),
    fetchTopPerformers(af_team_id, af_league_id, season, 7),
    fetchActiveInjuries(af_team_id, season, input.match_date),
  ]);

  const primaryFormation =
    stats.lineups && stats.lineups.length > 0 ? stats.lineups[0].formation : null;

  return {
    name: stats.team?.name ?? team_name,
    country: team_country,
    form_long: stats.form ?? '',
    played: stats.fixtures.played,
    wins: stats.fixtures.wins,
    draws: stats.fixtures.draws,
    loses: stats.fixtures.loses,
    goals_for_avg: stats.goals.for.average,
    goals_against_avg: stats.goals.against.average,
    clean_sheets: stats.clean_sheet.total,
    failed_to_score: stats.failed_to_score.total,
    biggest_streak: {
      wins: stats.biggest.streak.wins,
      loses: stats.biggest.streak.loses,
    },
    primary_formation: primaryFormation,
    top_performers: top.map((p) => ({
      af_player_id: p.player_id,
      photo: p.photo,
      name: p.player_name,
      position: p.position,
      is_captain: p.is_captain,
      lineups: p.lineups,
      minutes: p.minutes,
      goals: p.goals,
      assists: p.assists,
      rating: p.rating,
      shots_on_target: p.shots_on_target,
      key_passes: p.key_passes,
      passes_accuracy: p.passes_accuracy,
      duels_won_ratio: p.duels_won_ratio,
      saves: p.saves,
      goals_conceded: p.goals_conceded,
    })),
    active_injuries: injuries.map((i) => ({
      player_name: i.player_name,
      reason: i.reason,
    })),
    starting_eleven: input.starting_eleven,
  };
}
