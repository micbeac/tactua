// Import des amicaux internationaux impliquant les 48 sélections engagées
// à la Coupe du Monde 2026. Source : API-Football league=10.
//
// Usage : node --env-file=.env.local --experimental-strip-types \
//   scripts/import-international-friendlies.ts
//
// Variables d'env optionnelles :
//   FRIENDLIES_SEASON=2026         # défaut 2026
//   FRIENDLIES_LOOKBACK_DAYS=30    # fenêtre passée (défaut 30 jours)
//   FRIENDLIES_HORIZON_DAYS=60     # fenêtre future (défaut 60 jours)
//   FRIENDLIES_ENRICH=1            # (défaut 1) enrich les matchs finis
//
// Couvre l'import + l'enrichissement (lineups + stats équipe + stats joueur
// + events) via API-Football. Les analyses pré-match et les angles vidéo se
// génèrent ensuite normalement depuis l'admin pour ces matchs.

import { enrichMatchFromApiFootball } from '../lib/api-football/enrich.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const SEASON = Number(process.env.FRIENDLIES_SEASON ?? 2026);
const LOOKBACK_DAYS = Number(process.env.FRIENDLIES_LOOKBACK_DAYS ?? 30);
const HORIZON_DAYS = Number(process.env.FRIENDLIES_HORIZON_DAYS ?? 60);
const ENRICH = process.env.FRIENDLIES_ENRICH !== '0';

const AF_LEAGUE_ID = 10; // International - Friendlies
const COMPETITION_ID = 9990;

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
  const json = (await res.json()) as T & { errors?: unknown };
  const errs = (json as { errors?: unknown }).errors;
  if (
    errs != null &&
    !Array.isArray(errs) &&
    typeof errs === 'object' &&
    Object.keys(errs).length > 0
  ) {
    throw new Error(`AF error: ${JSON.stringify(errs).slice(0, 200)}`);
  }
  return json as T;
}

type AFStatus =
  | 'TBD' | 'NS' | '1H' | 'HT' | '2H' | 'ET' | 'BT' | 'P' | 'SUSP'
  | 'INT' | 'FT' | 'AET' | 'PEN' | 'PST' | 'CANC' | 'ABD' | 'AWD' | 'WO' | 'LIVE';

function mapAfStatus(s: AFStatus): 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' {
  if (['NS', 'TBD'].includes(s)) return 'scheduled';
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(s)) return 'live';
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(s)) return 'finished';
  if (['PST', 'SUSP'].includes(s)) return 'postponed';
  return 'cancelled';
}

type FixturesResponse = {
  response: Array<{
    fixture: {
      id: number;
      date: string;
      status: { short: AFStatus };
      venue: { name: string | null };
    };
    teams: {
      home: { id: number; name: string };
      away: { id: number; name: string };
    };
    goals: { home: number | null; away: number | null };
    score: {
      halftime: { home: number | null; away: number | null };
    };
  }>;
};

async function main() {
  const supabase = createAdminClient();

  console.log(
    `▶ Import amicaux internationaux saison ${SEASON} (fenêtre -${LOOKBACK_DAYS}j → +${HORIZON_DAYS}j)`,
  );

  // 1) IDs AF des sélections nationales engagées (joueurs ayant été convoqués)
  const { data: squads } = await supabase
    .from('national_team_squads')
    .select('team_id')
    .limit(5000);
  const wcDbTeamIds = new Set<number>();
  for (const r of (squads ?? []) as { team_id: number | null }[]) {
    if (r.team_id != null) wcDbTeamIds.add(r.team_id);
  }
  // Union avec les équipes des matchs CDM (au cas où une sélection est inscrite
  // sans squad encore importée).
  const { data: wcMatches } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id')
    .eq('competition_id', 2000);
  for (const r of (wcMatches ?? []) as {
    home_team_id: number | null;
    away_team_id: number | null;
  }[]) {
    if (r.home_team_id != null) wcDbTeamIds.add(r.home_team_id);
    if (r.away_team_id != null) wcDbTeamIds.add(r.away_team_id);
  }

  // Map DB team_id → AF team_id
  const { data: teamRows } = await supabase
    .from('teams')
    .select('id, api_football_id, name')
    .in('id', Array.from(wcDbTeamIds))
    .not('api_football_id', 'is', null);

  type TeamRow = { id: number; api_football_id: number | null; name: string };
  const afToDb = new Map<number, { id: number; name: string }>();
  for (const t of (teamRows ?? []) as TeamRow[]) {
    if (t.api_football_id != null) {
      afToDb.set(t.api_football_id, { id: t.id, name: t.name });
    }
  }
  console.log(`  ${afToDb.size} sélections nationales mappées AF↔DB`);

  // 2) Fetch toutes les fixtures du league friendlies
  const json = await af<FixturesResponse>(
    `/fixtures?league=${AF_LEAGUE_ID}&season=${SEASON}`,
  );
  console.log(`  ${json.response.length} fixtures retournées par AF`);

  const now = Date.now();
  const lowerMs = now - LOOKBACK_DAYS * 86_400_000;
  const upperMs = now + HORIZON_DAYS * 86_400_000;

  // 3) Filtre : au moins une équipe est dans notre set WC, dans la fenêtre
  const candidates: Array<{
    af_fixture_id: number;
    kickoff_iso: string;
    status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
    home_db_id: number;
    away_db_id: number;
    venue: string | null;
    score_home: number | null;
    score_away: number | null;
    ht_home: number | null;
    ht_away: number | null;
  }> = [];

  let skipped = 0;
  for (const fx of json.response) {
    const ts = Date.parse(fx.fixture.date);
    if (!Number.isFinite(ts)) continue;
    if (ts < lowerMs || ts > upperMs) {
      skipped += 1;
      continue;
    }
    const home = afToDb.get(fx.teams.home.id);
    const away = afToDb.get(fx.teams.away.id);
    if (!home || !away) {
      skipped += 1;
      continue;
    }
    candidates.push({
      af_fixture_id: fx.fixture.id,
      kickoff_iso: fx.fixture.date,
      status: mapAfStatus(fx.fixture.status.short),
      home_db_id: home.id,
      away_db_id: away.id,
      venue: fx.fixture.venue?.name ?? null,
      score_home: fx.goals.home,
      score_away: fx.goals.away,
      ht_home: fx.score.halftime?.home ?? null,
      ht_away: fx.score.halftime?.away ?? null,
    });
  }
  console.log(`  ${candidates.length} match(s) retenu(s) (${skipped} ignoré(s))`);

  // 4) Upsert dans matches. On utilise l'AF fixture id comme matches.id pour
  // éviter de gérer les collisions avec les ids FD (ranges très différents).
  let inserted = 0;
  for (const c of candidates) {
    const { error } = await supabase.from('matches').upsert(
      {
        id: c.af_fixture_id,
        competition_id: COMPETITION_ID,
        kickoff_at: c.kickoff_iso,
        status: c.status,
        home_team_id: c.home_db_id,
        away_team_id: c.away_db_id,
        score_home: c.score_home,
        score_away: c.score_away,
        half_time_home: c.ht_home,
        half_time_away: c.ht_away,
        venue: c.venue,
        api_football_fixture_id: c.af_fixture_id,
      },
      { onConflict: 'id' },
    );
    if (error) {
      console.error(
        `  ✗ upsert match ${c.af_fixture_id}: ${error.message}`,
      );
      continue;
    }
    inserted += 1;
  }
  console.log(`  ✅ ${inserted} match(s) upserté(s) dans la table matches`);

  if (!ENRICH) {
    console.log('\n(Skip enrich — FRIENDLIES_ENRICH=0)');
    return;
  }

  // 5) Enrich les matchs déjà finis (lineups + stats + events + players)
  const finished = candidates.filter((c) => c.status === 'finished');
  console.log(
    `\n▶ Enrich des ${finished.length} match(s) terminé(s) via API-Football...`,
  );

  let okCount = 0;
  let errCount = 0;
  for (const c of finished) {
    try {
      const r = await enrichMatchFromApiFootball(supabase, c.af_fixture_id);
      okCount += 1;
      console.log(
        `  [${c.af_fixture_id}] events:${r.events_upserted ?? 0} stats:${r.team_stats_upserted ?? 0} lineups:${r.lineups_upserted ?? 0} players:${r.player_stats_upserted ?? 0}`,
      );
    } catch (e) {
      errCount += 1;
      console.error(
        `  ✗ enrich ${c.af_fixture_id}: ${e instanceof Error ? e.message : e}`,
      );
    }
    // Petit délai pour respecter rate-limit par minute AF
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`\n✅ Terminé : ${okCount} enrich OK · ${errCount} échec(s)`);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
