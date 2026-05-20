// Import complet de la Jupiler Pro League via API-Football uniquement.
// (Football-Data ne la couvre pas dans le free tier.)
//
// Lancer : node --env-file=.env.local --experimental-strip-types scripts/import-jupiler-pro-league.ts
//
// Ce script :
// 1. Fetch tous les teams JPL via /teams?league=144&season=2025
// 2. Pour chaque team : upsert dans public.teams (id interne = AF id + 50000 pour
//    éviter les collisions avec les IDs FD existants — sauf si le team est déjà
//    en DB via une autre compétition, auquel cas on garde l'id existant).
// 3. Fetch toutes les fixtures via /fixtures?league=144&season=2025
// 4. Pour chaque fixture : upsert dans public.matches avec competition_id=9001
//    et api_football_fixture_id pré-mappé.
// 5. Fetch standings via /standings?league=144&season=2025
// 6. Pour chaque ligne : upsert dans public.team_season_stats.

import { createAdminClient } from '../lib/supabase/admin.ts';

const AF_LEAGUE_ID = 144;
const SEASON = 2025;
const COMPETITION_ID = 9001;
const TEAM_ID_OFFSET = 50000; // pour les nouvelles équipes inconnues du DB

function apiKey(): string {
  const k = process.env.API_FOOTBALL_KEY;
  if (!k) throw new Error('API_FOOTBALL_KEY manquant');
  return k;
}

async function af<T>(path: string): Promise<T> {
  const res = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: { 'x-apisports-key': apiKey(), Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`API-Football ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

type TeamsResponse = {
  response: Array<{
    team: {
      id: number;
      name: string;
      code: string | null;
      country: string;
      founded: number | null;
      logo: string;
    };
    venue: {
      name: string | null;
      city: string | null;
    };
  }>;
};

type FixturesResponse = {
  response: Array<{
    fixture: {
      id: number;
      date: string;
      timestamp: number;
      status: { short: string; long: string };
      venue: { name: string | null; city: string | null };
      referee: string | null;
    };
    league: {
      season: number;
      round: string;
    };
    teams: {
      home: { id: number; name: string };
      away: { id: number; name: string };
    };
    goals: { home: number | null; away: number | null };
    score: {
      halftime: { home: number | null; away: number | null };
      fulltime: { home: number | null; away: number | null };
    };
  }>;
};

type StandingsResponse = {
  response: Array<{
    league: {
      standings: Array<
        Array<{
          rank: number;
          team: { id: number; name: string };
          points: number;
          goalsDiff: number;
          all: {
            played: number;
            win: number;
            draw: number;
            lose: number;
            goals: { for: number; against: number };
          };
        }>
      >;
    };
  }>;
};

function statusFromAF(short: string): 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' {
  // AF status codes : https://www.api-football.com/documentation-v3#tag/Fixtures
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished';
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return 'live';
  if (['PST', 'TBD'].includes(short)) return 'postponed';
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(short)) return 'cancelled';
  return 'scheduled';
}

const supabase = createAdminClient();

async function main() {
  console.log('▶ Import Jupiler Pro League (AF league 144, saison 2025-26)\n');

  // ============================================================================
  // 1. TEAMS
  // ============================================================================
  console.log('1. Fetch teams...');
  const teamsResp = await af<TeamsResponse>(
    `/teams?league=${AF_LEAGUE_ID}&season=${SEASON}`,
  );
  console.log(`  ${teamsResp.response.length} équipes côté AF`);

  // Préchargement des équipes déjà en DB via api_football_id
  const afIds = teamsResp.response.map((t) => t.team.id);
  const { data: existingTeams } = await supabase
    .from('teams')
    .select('id, api_football_id')
    .in('api_football_id', afIds);

  const afToDbId = new Map<number, number>();
  for (const t of (existingTeams ?? []) as Array<{
    id: number;
    api_football_id: number;
  }>) {
    afToDbId.set(t.api_football_id, t.id);
  }

  let teamsInserted = 0;
  let teamsUpdated = 0;
  for (const t of teamsResp.response) {
    const existingId = afToDbId.get(t.team.id);
    const dbId = existingId ?? TEAM_ID_OFFSET + t.team.id;
    afToDbId.set(t.team.id, dbId);

    const payload = {
      id: dbId,
      name: t.team.name,
      tla: t.team.code,
      country: t.team.country,
      founded: t.team.founded,
      venue: t.venue.name,
      logo_url: t.team.logo,
      api_football_id: t.team.id,
    };
    const { error } = await supabase
      .from('teams')
      .upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error(`  ✗ ${t.team.name}: ${error.message}`);
      continue;
    }
    if (existingId) teamsUpdated += 1;
    else teamsInserted += 1;
  }
  console.log(`  ✅ ${teamsInserted} insérées, ${teamsUpdated} mises à jour\n`);

  // ============================================================================
  // 2. FIXTURES
  // ============================================================================
  console.log('2. Fetch fixtures...');
  const fixturesResp = await af<FixturesResponse>(
    `/fixtures?league=${AF_LEAGUE_ID}&season=${SEASON}`,
  );
  console.log(`  ${fixturesResp.response.length} fixtures côté AF`);

  let matchesUpserted = 0;
  for (const f of fixturesResp.response) {
    const homeDbId = afToDbId.get(f.teams.home.id);
    const awayDbId = afToDbId.get(f.teams.away.id);
    if (!homeDbId || !awayDbId) continue;

    // Match ID : on utilise un offset pour ne pas collisionner avec les FD IDs
    const matchId = 9000000 + f.fixture.id;

    const payload = {
      id: matchId,
      competition_id: COMPETITION_ID,
      home_team_id: homeDbId,
      away_team_id: awayDbId,
      kickoff_at: f.fixture.date,
      status: statusFromAF(f.fixture.status.short),
      stage: 'Regular Season',
      matchday: parseInt(f.league.round.match(/\d+/)?.[0] ?? '0', 10) || null,
      venue: f.fixture.venue.name,
      referee: f.fixture.referee,
      score_home: f.score.fulltime.home ?? f.goals.home,
      score_away: f.score.fulltime.away ?? f.goals.away,
      half_time_home: f.score.halftime.home,
      half_time_away: f.score.halftime.away,
      api_football_fixture_id: f.fixture.id,
    };
    const { error } = await supabase
      .from('matches')
      .upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error(`  ✗ match ${matchId}: ${error.message}`);
      continue;
    }
    matchesUpserted += 1;
  }
  console.log(`  ✅ ${matchesUpserted} matchs upsertés\n`);

  // ============================================================================
  // 3. STANDINGS
  // ============================================================================
  console.log('3. Fetch standings...');
  const standingsResp = await af<StandingsResponse>(
    `/standings?league=${AF_LEAGUE_ID}&season=${SEASON}`,
  );
  const standings = standingsResp.response[0]?.league?.standings?.[0] ?? [];
  console.log(`  ${standings.length} lignes de classement`);

  let standingsUpserted = 0;
  for (const row of standings) {
    const dbId = afToDbId.get(row.team.id);
    if (!dbId) continue;
    const payload = {
      team_id: dbId,
      competition_id: COMPETITION_ID,
      season: String(SEASON),
      position: row.rank,
      played: row.all.played,
      wins: row.all.win,
      draws: row.all.draw,
      losses: row.all.lose,
      goals_for: row.all.goals.for,
      goals_against: row.all.goals.against,
      goal_difference: row.goalsDiff,
      points: row.points,
    };
    const { error } = await supabase
      .from('team_season_stats')
      .upsert(payload, { onConflict: 'team_id,competition_id,season' });
    if (error) {
      console.error(`  ✗ team ${row.team.name}: ${error.message}`);
      continue;
    }
    standingsUpserted += 1;
  }
  console.log(`  ✅ ${standingsUpserted} lignes de classement upsertées\n`);

  console.log('✅ Import JPL terminé !');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
