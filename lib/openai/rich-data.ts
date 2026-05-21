// Construit le MatchRichData à partir du DeepPreMatchContext.
// Tous les chiffres viennent des données réelles (API-Football), pas de l'IA.

import type { DeepPreMatchContext, DeepTeamContext } from './analyses';
import type {
  AbsentPlayer,
  MatchRichData,
  PlayerSeasonStat,
  RadarDimension,
  RecentFormResult,
  StatComparison,
} from './types';

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

function parseNum(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function lastN(str: string, n: number): RecentFormResult[] {
  return str
    .slice(-n)
    .split('')
    .map((c) => (c === 'W' || c === 'D' || c === 'L' ? c : 'D'));
}

function formPoints(str: string): { pts: number; max: number } {
  const max = str.length * 3;
  let pts = 0;
  for (const c of str) {
    if (c === 'W') pts += 3;
    else if (c === 'D') pts += 1;
  }
  return { pts, max };
}

/** Score Attaque (0-100) basé sur buts marqués/match (référence 3 = excellent). */
function scoreAttack(t: DeepTeamContext): number {
  const goalsAvg = parseNum(t.goals_for_avg.total);
  return clamp(goalsAvg * 33);
}

/** Score Défense (0-100) : inverse buts encaissés + bonus clean sheets. */
function scoreDefense(t: DeepTeamContext): number {
  const conceded = parseNum(t.goals_against_avg.total);
  const cleanRate = t.played.total > 0 ? t.clean_sheets / t.played.total : 0;
  return clamp((2 - conceded) * 35 + cleanRate * 35);
}

/** Score Forme (0-100) : points sur la forme longue. */
function scoreForm(t: DeepTeamContext): number {
  if (!t.form_long) return 50;
  const { pts, max } = formPoints(t.form_long);
  return clamp((pts / max) * 100);
}

/** Score Régularité (0-100) : ratio V+N / matchs joués. */
function scoreConsistency(t: DeepTeamContext): number {
  if (t.played.total === 0) return 50;
  return clamp(((t.wins.total + t.draws.total) / t.played.total) * 100);
}

/** Score Globale (0-100) : points sur la saison rapportés au max possible. */
function scoreOverall(t: DeepTeamContext): number {
  if (t.played.total === 0) return 50;
  const pts = t.wins.total * 3 + t.draws.total;
  const max = t.played.total * 3;
  return clamp((pts / max) * 100);
}

function buildRadar(
  home: DeepTeamContext,
  away: DeepTeamContext,
): RadarDimension[] {
  return [
    { label: 'Attaque', home: Math.round(scoreAttack(home)), away: Math.round(scoreAttack(away)) },
    { label: 'Défense', home: Math.round(scoreDefense(home)), away: Math.round(scoreDefense(away)) },
    { label: 'Forme', home: Math.round(scoreForm(home)), away: Math.round(scoreForm(away)) },
    {
      label: 'Régularité',
      home: Math.round(scoreConsistency(home)),
      away: Math.round(scoreConsistency(away)),
    },
    {
      label: 'Globale',
      home: Math.round(scoreOverall(home)),
      away: Math.round(scoreOverall(away)),
    },
  ];
}

function adv(home: number, away: number): 'home' | 'away' | 'equal' {
  if (Math.abs(home - away) < 0.05) return 'equal';
  return home > away ? 'home' : 'away';
}

/** Inverse : pour des stats où "plus bas = mieux" (ex: buts encaissés). */
function advInverse(home: number, away: number): 'home' | 'away' | 'equal' {
  if (Math.abs(home - away) < 0.05) return 'equal';
  return home < away ? 'home' : 'away';
}

function buildStatsCompare(
  home: DeepTeamContext,
  away: DeepTeamContext,
): StatComparison[] {
  const out: StatComparison[] = [];

  const homeGoalsAvg = parseNum(home.goals_for_avg.total);
  const awayGoalsAvg = parseNum(away.goals_for_avg.total);
  out.push({
    label: 'Buts marqués / match',
    home: home.goals_for_avg.total,
    away: away.goals_for_avg.total,
    advantage: adv(homeGoalsAvg, awayGoalsAvg),
  });

  const homeConceded = parseNum(home.goals_against_avg.total);
  const awayConceded = parseNum(away.goals_against_avg.total);
  out.push({
    label: 'Buts encaissés / match',
    home: home.goals_against_avg.total,
    away: away.goals_against_avg.total,
    advantage: advInverse(homeConceded, awayConceded),
  });

  out.push({
    label: 'Clean sheets',
    home: String(home.clean_sheets),
    away: String(away.clean_sheets),
    advantage: adv(home.clean_sheets, away.clean_sheets),
  });

  out.push({
    label: 'Matchs sans marquer',
    home: String(home.failed_to_score),
    away: String(away.failed_to_score),
    advantage: advInverse(home.failed_to_score, away.failed_to_score),
  });

  out.push({
    label: 'Bilan saison',
    home: `${home.wins.total}V-${home.draws.total}N-${home.loses.total}D`,
    away: `${away.wins.total}V-${away.draws.total}N-${away.loses.total}D`,
    advantage: adv(home.wins.total, away.wins.total),
  });

  out.push({
    label: 'Bilan dom./ext.',
    home: `${home.wins.home}V-${home.draws.home}N-${home.loses.home}D dom.`,
    away: `${away.wins.away}V-${away.draws.away}N-${away.loses.away}D ext.`,
    advantage: 'equal',
  });

  out.push({
    label: 'Meilleure série victoires',
    home: String(home.biggest_streak.wins),
    away: String(away.biggest_streak.wins),
    advantage: adv(home.biggest_streak.wins, away.biggest_streak.wins),
  });

  return out;
}

function buildTopPlayers(
  home: DeepTeamContext,
  away: DeepTeamContext,
  afToDbPlayerId: Map<number, number>,
): PlayerSeasonStat[] {
  // Top 4 par équipe (au lieu de top 7 dans le contexte IA) pour le rendu compact.
  const mapPerf =
    (team: 'home' | 'away') =>
    (p: DeepTeamContext['top_performers'][number]): PlayerSeasonStat => ({
      af_player_id: p.af_player_id,
      db_player_id: afToDbPlayerId.get(p.af_player_id) ?? null,
      photo: p.photo,
      name: p.name,
      team,
      position: p.position,
      is_captain: p.is_captain,
      appearances: p.lineups,
      goals: p.goals,
      assists: p.assists,
      rating: p.rating,
      shots_on_target: p.shots_on_target,
      key_passes: p.key_passes,
      passes_accuracy: p.passes_accuracy,
    });
  const homeTop = home.top_performers.slice(0, 4).map(mapPerf('home'));
  const awayTop = away.top_performers.slice(0, 4).map(mapPerf('away'));
  return [...homeTop, ...awayTop];
}

function buildAbsents(
  home: DeepTeamContext,
  away: DeepTeamContext,
): AbsentPlayer[] {
  return [
    ...home.active_injuries.map((i) => ({
      team: 'home' as const,
      name: i.player_name,
      reason: i.reason,
    })),
    ...away.active_injuries.map((i) => ({
      team: 'away' as const,
      name: i.player_name,
      reason: i.reason,
    })),
  ];
}

function summarizeH2H(
  ctx: DeepPreMatchContext,
  homeTeamName: string,
): { home_wins: number; draws: number; away_wins: number; total: number } {
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  for (const h of ctx.head_to_head) {
    if (h.score_home == null || h.score_away == null) continue;
    const homeIsHomeTeam = h.home_team === homeTeamName;
    if (h.score_home === h.score_away) draws += 1;
    else if (h.score_home > h.score_away) {
      if (homeIsHomeTeam) homeWins += 1;
      else awayWins += 1;
    } else {
      if (homeIsHomeTeam) awayWins += 1;
      else homeWins += 1;
    }
  }
  const total = ctx.head_to_head.length;
  return { home_wins: homeWins, draws, away_wins: awayWins, total };
}

export function buildRichData(
  ctx: DeepPreMatchContext,
  afToDbPlayerId: Map<number, number> = new Map(),
): MatchRichData {
  return {
    stats_compare: buildStatsCompare(ctx.home, ctx.away),
    radar: buildRadar(ctx.home, ctx.away),
    form_home: lastN(ctx.home.form_long, 5),
    form_away: lastN(ctx.away.form_long, 5),
    form_long_home: ctx.home.form_long.slice(-10),
    form_long_away: ctx.away.form_long.slice(-10),
    top_players: buildTopPlayers(ctx.home, ctx.away, afToDbPlayerId),
    absent_players: buildAbsents(ctx.home, ctx.away),
    formation_home: ctx.home.primary_formation,
    formation_away: ctx.away.primary_formation,
    h2h_summary: summarizeH2H(ctx, ctx.home.name),
  };
}
