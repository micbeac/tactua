// PoC analyse IA pré-match enrichie avec stats détaillées via API-Football Pro.
// Lancer : node --env-file=.env.local scripts/test-deep-analysis.ts
//
// Pour cet exemple : Bologna vs Inter, Serie A 2025-26, 23 mai 2026 (match 537187).

import {
  fetchActiveInjuries,
  fetchH2H,
  fetchTeamStats,
  fetchTopPerformers,
} from '../lib/api-football/deep-stats.ts';
import {
  generateDeepPreMatchAnalysis,
  type DeepPreMatchContext,
  type DeepTeamContext,
} from '../lib/openai/analyses.ts';

// IDs API-Football
const LEAGUE_ID = 135; // Serie A
const SEASON = 2025; // 2025-26
const BOLOGNA_ID = 500;
const INTER_ID = 505;
const MATCH_DATE = new Date('2026-05-23T16:00:00Z');

async function buildTeamContext(
  teamId: number,
  teamName: string,
): Promise<DeepTeamContext> {
  console.log(`  ▶ team stats ${teamName}…`);
  const stats = await fetchTeamStats(teamId, LEAGUE_ID, SEASON);
  console.log(`  ▶ top performers ${teamName}…`);
  const top = await fetchTopPerformers(teamId, LEAGUE_ID, SEASON, 7);
  console.log(`  ▶ injuries ${teamName}…`);
  const injuries = await fetchActiveInjuries(teamId, SEASON, MATCH_DATE);

  const primaryFormation =
    stats.lineups && stats.lineups.length > 0
      ? stats.lineups[0].formation
      : null;

  return {
    name: stats.team.name,
    country: 'Italy',
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
    starting_eleven: [],
  };
}

async function main() {
  console.log('▶ Construction du contexte deep…');
  const home = await buildTeamContext(BOLOGNA_ID, 'Bologna');
  const away = await buildTeamContext(INTER_ID, 'Inter');

  console.log('  ▶ H2H Bologna-Inter…');
  const h2h = await fetchH2H(BOLOGNA_ID, INTER_ID, 10);

  const ctx: DeepPreMatchContext = {
    competition: 'Serie A',
    stage_or_matchday: 'Journée 38',
    kickoff_at_iso: '2026-05-23T16:00:00Z',
    venue: "Stadio Renato Dall'Ara",
    home,
    away,
    head_to_head: h2h.map((h) => ({
      date: h.date,
      home_team: h.home_team,
      away_team: h.away_team,
      score_home: h.score_home,
      score_away: h.score_away,
    })),
  };

  console.log('\n--- Récapitulatif contexte ---');
  console.log(
    `Bologna : ${home.played.total} matchs, ${home.wins.total}V/${home.draws.total}N/${home.loses.total}D, ${home.goals_for_avg.total} buts/match (avg), top: ${home.top_performers[0]?.name} (${home.top_performers[0]?.goals}b), ${home.active_injuries.length} indispos`,
  );
  console.log(
    `Inter    : ${away.played.total} matchs, ${away.wins.total}V/${away.draws.total}N/${away.loses.total}D, ${away.goals_for_avg.total} buts/match (avg), top: ${away.top_performers[0]?.name} (${away.top_performers[0]?.goals}b), ${away.active_injuries.length} indispos`,
  );
  console.log(`H2H récents : ${h2h.length} matchs`);

  console.log('\n▶ Appel gpt-4o-mini avec contexte enrichi…');
  const t0 = Date.now();
  const { analysis, model, usage } = await generateDeepPreMatchAnalysis(ctx);
  const elapsed = Date.now() - t0;
  console.log(
    `  OK en ${elapsed}ms (in: ${usage.input}t / out: ${usage.output}t)`,
  );

  console.log('\n--- ANALYSE GÉNÉRÉE ---\n');
  console.log(JSON.stringify(analysis, null, 2));

  console.log('\n--- VERIF PROBA ---');
  const probaSum =
    analysis.prediction.probabilities.home_win +
    analysis.prediction.probabilities.draw +
    analysis.prediction.probabilities.away_win;
  console.log(`Somme probas : ${probaSum}% (doit être ~100)`);
  console.log(`Confiance : ${analysis.prediction.confidence}`);
  console.log(`Score plausible : ${analysis.prediction.scoreline_guess}`);
  console.log(
    `BTTS : ${analysis.prediction.btts} | Over 2.5 : ${analysis.prediction.over_2_5}`,
  );

  console.log('\n✅ PoC terminé.');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
