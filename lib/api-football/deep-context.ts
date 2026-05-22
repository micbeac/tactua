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

// Valeurs par défaut quand AF retourne un objet vide (équipe sans données
// pour cette saison/compétition). Évite les crashes "Cannot read 'played'".
const EMPTY_SPLIT = { home: 0, away: 0, total: 0 };
const EMPTY_AVG = { home: '0', away: '0', total: '0' };

export async function buildDeepTeamContext(
  input: BuildDeepTeamContextInput,
): Promise<DeepTeamContext> {
  const { af_team_id, af_league_id, season, team_name, team_country } = input;

  const [stats, top, injuries] = await Promise.all([
    fetchTeamStats(af_team_id, af_league_id, season),
    fetchTopPerformers(af_team_id, af_league_id, season, 7),
    fetchActiveInjuries(af_team_id, season, input.match_date),
  ]);

  // AF peut retourner un objet quasi-vide si pas de stats pour la
  // saison/compétition. On garantit des fallbacks pour ne pas crasher.
  const safeStats = stats ?? ({} as Partial<typeof stats>);
  const fx = safeStats.fixtures ?? {
    played: EMPTY_SPLIT,
    wins: EMPTY_SPLIT,
    draws: EMPTY_SPLIT,
    loses: EMPTY_SPLIT,
  };
  const gls = safeStats.goals ?? {
    for: { total: EMPTY_SPLIT, average: EMPTY_AVG },
    against: { total: EMPTY_SPLIT, average: EMPTY_AVG },
  };
  const cs = safeStats.clean_sheet ?? EMPTY_SPLIT;
  const fts = safeStats.failed_to_score ?? EMPTY_SPLIT;
  const big = safeStats.biggest ?? {
    streak: { wins: 0, draws: 0, loses: 0 },
    wins: { home: null, away: null },
    loses: { home: null, away: null },
    goals: { for: { home: 0, away: 0 }, against: { home: 0, away: 0 } },
  };

  const primaryFormation =
    safeStats.lineups && safeStats.lineups.length > 0
      ? safeStats.lineups[0].formation
      : null;

  // Répartition temporelle des buts (% tôt 0-15' / tard 76'→)
  const goalTiming = (
    minute?: Record<string, { total: number | null }>,
  ): { early: number | null; late: number | null } => {
    if (!minute) return { early: null, late: null };
    let grand = 0;
    let early = 0;
    let late = 0;
    for (const [bucket, v] of Object.entries(minute)) {
      const t = v?.total ?? 0;
      grand += t;
      if (bucket === '0-15') early += t;
      if (bucket === '76-90' || bucket === '91-105' || bucket === '106-120') {
        late += t;
      }
    }
    if (grand === 0) return { early: null, late: null };
    return {
      early: Math.round((early / grand) * 100),
      late: Math.round((late / grand) * 100),
    };
  };
  const forTiming = goalTiming(safeStats.goals?.for?.minute);
  const againstTiming = goalTiming(safeStats.goals?.against?.minute);

  return {
    name: safeStats.team?.name ?? team_name,
    country: team_country,
    form_long: safeStats.form ?? '',
    played: fx.played,
    wins: fx.wins,
    draws: fx.draws,
    loses: fx.loses,
    goals_for_avg: gls.for.average,
    goals_against_avg: gls.against.average,
    clean_sheets: cs.total,
    failed_to_score: fts.total,
    biggest_streak: {
      wins: big.streak.wins,
      loses: big.streak.loses,
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
    goal_timing: {
      scored_early_pct: forTiming.early,
      scored_late_pct: forTiming.late,
      conceded_early_pct: againstTiming.early,
      conceded_late_pct: againstTiming.late,
    },
  };
}
