// Backfill player_season_stats via api_football_id (matching propre, plus de nom).
//
// Pour chaque équipe ayant api_football_id non null, pour la compétition tracked
// (FD → AF), récupère tous les joueurs et leurs stats saison, écrit dans
// player_season_stats en joignant par players.api_football_id.
//
// Lancer :
//   node --env-file=.env.local scripts/backfill-player-season-stats.ts
//     → toutes les équipes, season 2025, leur compétition principale
//
//   node --env-file=.env.local scripts/backfill-player-season-stats.ts 2019
//     → uniquement la Serie A
//
// Quota AF : ~3 req par équipe (pagination) × 110 équipes ≈ 330 req. OK Pro.

import {
  fetchAggregatedTeamPerformers,
  fetchTopPerformers,
} from '../lib/api-football/deep-stats.ts';
import {
  TRACKED_COMPETITIONS,
  type TrackedCompetitionCode,
} from '../lib/cron/competitions.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const SEASON_DEFAULT = 2025;
const WC_SEASON = 2026; // World Cup 2026
const supabase = createAdminClient();

async function backfillTeamForCompetition(
  dbTeamId: number,
  afTeamId: number,
  teamName: string,
  fdCompetitionId: number,
  afLeagueId: number,
  competitionLabel: string,
  isWorldCup: boolean,
) {
  console.log(`  ▶ ${teamName} dans ${competitionLabel}`);
  const season = isWorldCup ? WC_SEASON : SEASON_DEFAULT;

  // Pour les sélections nationales (WC) : on agrège toutes les leagues
  // internationales sur la saison (Friendlies, Nations League, qualifs…).
  // Pour les clubs : on filtre sur la league exacte.
  const perfs = isWorldCup
    ? await fetchAggregatedTeamPerformers(afTeamId, season, 100)
    : await fetchTopPerformers(afTeamId, afLeagueId, season, 100);
  if (perfs.length === 0) {
    console.log(`    Aucun joueur avec stats`);
    return { matched: 0, missing: 0 };
  }

  // Charge le mapping AF→DB pour tous les joueurs de l'équipe.
  const afIds = perfs.map((p) => p.player_id);
  const { data: dbPlayers } = await supabase
    .from('players')
    .select('id, api_football_id')
    .in('api_football_id', afIds);

  const afToDb = new Map<number, number>();
  for (const p of (dbPlayers ?? []) as Array<{
    id: number;
    api_football_id: number;
  }>) {
    afToDb.set(p.api_football_id, p.id);
  }

  const rows: Array<{
    player_id: number;
    competition_id: number;
    season: string;
    appearances: number;
    minutes: number;
    goals: number;
    assists: number;
    yellow_cards: number;
    red_cards: number;
  }> = [];

  let missing = 0;
  for (const p of perfs) {
    const dbId = afToDb.get(p.player_id);
    if (!dbId) {
      missing += 1;
      continue;
    }
    rows.push({
      player_id: dbId,
      competition_id: fdCompetitionId,
      season: String(season),
      appearances: p.appearances,
      minutes: p.minutes,
      goals: p.goals,
      assists: p.assists,
      yellow_cards: p.yellow_cards,
      red_cards: p.red_cards,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from('player_season_stats')
      .upsert(rows, { onConflict: 'player_id,competition_id,season' });
    if (error) throw new Error(`upsert: ${error.message}`);
  }

  console.log(`    ✅ ${rows.length} upserted, ${missing} sans mapping AF→DB`);
  return { matched: rows.length, missing };
}

async function backfillCompetition(code: TrackedCompetitionCode) {
  const comp = TRACKED_COMPETITIONS.find((c) => c.code === code);
  if (!comp) throw new Error(`Compétition ${code} inconnue`);

  console.log(`\n▶ ${comp.label} (FD ${comp.fd_id} / AF ${comp.af_league_id})`);

  // Équipes ayant joué dans cette compétition + api_football_id non null.
  const { data: matchRows } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id')
    .eq('competition_id', comp.fd_id)
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null);

  const teamIds = new Set<number>();
  for (const m of (matchRows ?? []) as Array<{
    home_team_id: number;
    away_team_id: number;
  }>) {
    teamIds.add(m.home_team_id);
    teamIds.add(m.away_team_id);
  }

  if (teamIds.size === 0) {
    console.log('  Aucun match en DB pour cette compétition');
    return;
  }

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, api_football_id')
    .in('id', Array.from(teamIds))
    .not('api_football_id', 'is', null)
    .order('id', { ascending: true });

  type TeamRow = { id: number; name: string; api_football_id: number };
  const list = (teams ?? []) as TeamRow[];
  console.log(`  ${list.length} équipes mappées AF`);

  let totalMatched = 0;
  let totalMissing = 0;
  for (const t of list) {
    try {
      const r = await backfillTeamForCompetition(
        t.id,
        t.api_football_id,
        t.name,
        comp.fd_id,
        comp.af_league_id,
        comp.label,
        comp.code === 'WC',
      );
      totalMatched += r.matched;
      totalMissing += r.missing;
      await new Promise((r) => setTimeout(r, 600));
    } catch (e) {
      console.error(`    ✗ ${t.name} :`, e instanceof Error ? e.message : e);
    }
  }
  console.log(
    `  ✅ ${comp.label} : ${totalMatched} stats upserted, ${totalMissing} sans mapping`,
  );
}

async function main() {
  const codeArg = process.argv[2] as TrackedCompetitionCode | undefined;
  if (codeArg) {
    await backfillCompetition(codeArg);
    return;
  }
  // Toutes sauf World Cup (national teams, traité différemment)
  for (const c of TRACKED_COMPETITIONS) {
    if (c.code === 'WC') continue;
    await backfillCompetition(c.code);
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
