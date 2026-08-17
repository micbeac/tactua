// Import de la Jupiler Pro League depuis API-Football.
//
// La JPL est la seule compétition trackée que Football-Data ne couvre pas :
// elle est explicitement exclue de refresh-structures et refresh-rankings.
// Elle a longtemps dépendu d'un script lancé à la main
// (scripts/import-jupiler-pro-league.ts), avec deux conséquences : la saison
// y était figée en dur, et plus personne ne l'exécutait — la compétition est
// restée bloquée sur 2025-26 alors que le championnat belge avait repris.
//
// Cette logique est ici pour être appelée par un cron, comme les autres.
//
// Conventions d'identifiants, héritées du script et conservées pour ne pas
// casser les lignes existantes :
//   - team_id  = api_football_id + 50 000, sauf si l'équipe est déjà connue
//     en base via une autre compétition (Coupe d'Europe), auquel cas on garde
//     son id Football-Data.
//   - match_id = fixture_id API-Football + 9 000 000.
// Les deux offsets évitent la collision avec les identifiants Football-Data.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { af, fetchSquad } from './deep-stats';

type Supa = SupabaseClient<Database>;

export const JPL_AF_LEAGUE_ID = 144;
export const JPL_COMPETITION_ID = 9001;
const TEAM_ID_OFFSET = 50_000;
const MATCH_ID_OFFSET = 9_000_000;

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
    venue: { name: string | null; city: string | null };
  }>;
};

type FixturesResponse = {
  response: Array<{
    fixture: {
      id: number;
      date: string;
      status: { short: string };
      venue: { name: string | null };
      referee: string | null;
    };
    league: { season: number; round: string };
    teams: { home: { id: number }; away: { id: number } };
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
          team: { id: number };
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

type MatchStatus =
  | 'scheduled'
  | 'live'
  | 'finished'
  | 'postponed'
  | 'cancelled';

function statusFromAF(short: string): MatchStatus {
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished';
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(short))
    return 'live';
  if (['PST', 'TBD'].includes(short)) return 'postponed';
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(short)) return 'cancelled';
  return 'scheduled';
}

/** Mapping api_football_id → id interne, pour les équipes de la saison. */
async function resolveTeamIds(
  supabase: Supa,
  afTeamIds: number[],
): Promise<Map<number, number>> {
  const { data } = await supabase
    .from('teams')
    .select('id, api_football_id')
    .in('api_football_id', afTeamIds);

  const map = new Map<number, number>();
  for (const t of (data ?? []) as Array<{
    id: number;
    api_football_id: number;
  }>) {
    map.set(t.api_football_id, t.id);
  }
  // Les équipes inconnues prennent l'id décalé.
  for (const afId of afTeamIds) {
    if (!map.has(afId)) map.set(afId, TEAM_ID_OFFSET + afId);
  }
  return map;
}

export type JplCoreStats = {
  season: number;
  teams: number;
  matches: number;
  standings: number;
  errors: string[];
};

/**
 * Équipes + calendrier + classement. 3 appels API, upserts par lots.
 */
export async function importJplCore(
  supabase: Supa,
  season: number,
): Promise<JplCoreStats> {
  const stats: JplCoreStats = {
    season,
    teams: 0,
    matches: 0,
    standings: 0,
    errors: [],
  };

  // ---- 1. Équipes ----------------------------------------------------------
  const teamsResp = await af<TeamsResponse>(
    `/teams?league=${JPL_AF_LEAGUE_ID}&season=${season}`,
  );
  const afTeamIds = teamsResp.response.map((t) => t.team.id);
  if (afTeamIds.length === 0) {
    stats.errors.push(
      `aucune équipe renvoyée pour la saison ${season} — saison probablement pas encore ouverte côté API-Football`,
    );
    return stats;
  }

  const idMap = await resolveTeamIds(supabase, afTeamIds);

  const teamRows = teamsResp.response.map((t) => ({
    id: idMap.get(t.team.id)!,
    name: t.team.name,
    tla: t.team.code,
    country: t.team.country,
    founded: t.team.founded,
    venue: t.venue.name,
    logo_url: t.team.logo,
    api_football_id: t.team.id,
  }));

  const { error: tErr } = await supabase
    .from('teams')
    .upsert(teamRows, { onConflict: 'id' });
  if (tErr) throw new Error(`teams upsert: ${tErr.message}`);
  stats.teams = teamRows.length;

  // ---- 2. Calendrier -------------------------------------------------------
  const fixturesResp = await af<FixturesResponse>(
    `/fixtures?league=${JPL_AF_LEAGUE_ID}&season=${season}`,
  );

  const matchRows = fixturesResp.response
    .map((f) => {
      const home = idMap.get(f.teams.home.id);
      const away = idMap.get(f.teams.away.id);
      if (!home || !away) return null;
      return {
        id: MATCH_ID_OFFSET + f.fixture.id,
        competition_id: JPL_COMPETITION_ID,
        home_team_id: home,
        away_team_id: away,
        kickoff_at: f.fixture.date,
        status: statusFromAF(f.fixture.status.short),
        stage: 'Regular Season',
        matchday:
          parseInt(f.league.round.match(/\d+/)?.[0] ?? '0', 10) || null,
        venue: f.fixture.venue.name,
        referee: f.fixture.referee,
        score_home: f.score.fulltime.home ?? f.goals.home,
        score_away: f.score.fulltime.away ?? f.goals.away,
        half_time_home: f.score.halftime.home,
        half_time_away: f.score.halftime.away,
        api_football_fixture_id: f.fixture.id,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  if (matchRows.length) {
    const { error: mErr } = await supabase
      .from('matches')
      .upsert(matchRows, { onConflict: 'id' });
    if (mErr) throw new Error(`matches upsert: ${mErr.message}`);
    stats.matches = matchRows.length;
  }

  // ---- 3. Classement -------------------------------------------------------
  const standingsResp = await af<StandingsResponse>(
    `/standings?league=${JPL_AF_LEAGUE_ID}&season=${season}`,
  );
  const table = standingsResp.response[0]?.league?.standings?.[0] ?? [];

  const standingRows = table
    .map((row) => {
      const teamId = idMap.get(row.team.id);
      if (!teamId) return null;
      return {
        team_id: teamId,
        competition_id: JPL_COMPETITION_ID,
        season: String(season),
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
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (standingRows.length) {
    const { error: sErr } = await supabase
      .from('team_season_stats')
      .upsert(standingRows, { onConflict: 'team_id,competition_id,season' });
    if (sErr) throw new Error(`team_season_stats upsert: ${sErr.message}`);
    stats.standings = standingRows.length;
  }

  // ---- 4. Saison courante de la compétition --------------------------------
  // Indispensable : la page /competitions/[code] lit `current_season` puis
  // filtre le classement dessus. Sans cette écriture, on alimente la saison
  // 2026 pendant que la page continue d'afficher la table 2025 — c'est ce qui
  // laissait le classement JPL bloqué sur le playoff de la saison passée.
  const { error: compErr } = await supabase.from('competitions').upsert(
    {
      id: JPL_COMPETITION_ID,
      name: 'Jupiler Pro League',
      code: 'BJL',
      country: 'Belgium',
      current_season: String(season),
      api_football_league_id: JPL_AF_LEAGUE_ID,
      last_updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (compErr) throw new Error(`competitions upsert: ${compErr.message}`);

  return stats;
}

export type JplSquadStats = {
  teams_done: number;
  teams_skipped: number;
  players: number;
  errors: string[];
};

/**
 * Effectifs des clubs JPL — 1 appel API par club.
 *
 * Séparé du core : les fonctions Vercel Hobby sont coupées à 60 s, et une
 * vingtaine d'appels ne tient pas dans le même run que le calendrier. Le
 * budget de temps laisse le run rendre un compte rendu au lieu d'être tué.
 */
export async function importJplSquads(
  supabase: Supa,
  budgetMs: number,
): Promise<JplSquadStats> {
  const stats: JplSquadStats = {
    teams_done: 0,
    teams_skipped: 0,
    players: 0,
    errors: [],
  };
  const startedAt = Date.now();

  const { data: matchRows } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id')
    .eq('competition_id', JPL_COMPETITION_ID);

  const teamIds = new Set<number>();
  for (const m of (matchRows ?? []) as Array<{
    home_team_id: number | null;
    away_team_id: number | null;
  }>) {
    if (m.home_team_id) teamIds.add(m.home_team_id);
    if (m.away_team_id) teamIds.add(m.away_team_id);
  }
  if (teamIds.size === 0) return stats;

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, api_football_id')
    .in('id', [...teamIds])
    .not('api_football_id', 'is', null)
    // Les effectifs les plus anciennement rafraîchis d'abord, pour que des
    // runs successifs finissent par couvrir tout le championnat.
    .order('last_updated_at', { ascending: true, nullsFirst: true });

  for (const t of (teams ?? []) as Array<{
    id: number;
    name: string;
    api_football_id: number;
  }>) {
    if (Date.now() - startedAt > budgetMs) {
      stats.teams_skipped += 1;
      continue;
    }
    try {
      const squad = await fetchSquad(t.api_football_id);
      if (squad.length === 0) continue;

      // Déduplication : pendant le mercato, l'API peut lister un même joueur
      // deux fois. Postgres rejette sinon tout le lot (« cannot affect row a
      // second time »).
      const bySquadId = new Map<number, (typeof squad)[number]>();
      for (const p of squad) bySquadId.set(p.player_id, p);
      const unique = Array.from(bySquadId.values());

      // Un joueur déjà en base garde SON id interne : réutiliser l'id
      // API-Football brut écraserait un joueur Football-Data portant le même
      // numéro, ou créerait un doublon pour un joueur déjà connu.
      const { data: known } = await supabase
        .from('players')
        .select('id, api_football_id, name')
        .in(
          'api_football_id',
          unique.map((p) => p.player_id),
        );
      const afToDb = new Map<number, { id: number; name: string }>();
      for (const p of (known ?? []) as Array<{
        id: number;
        api_football_id: number;
        name: string;
      }>) {
        afToDb.set(p.api_football_id, { id: p.id, name: p.name });
      }

      // Inconnus : création complète, l'id AF servant d'id interne (même
      // convention que scripts/refresh-jpl-squads.ts, pour ne pas dédoubler
      // les joueurs déjà importés par ce script).
      const inserts = unique
        .filter((p) => !afToDb.has(p.player_id))
        .map((p) => ({
          id: p.player_id,
          api_football_id: p.player_id,
          name: p.name,
          position: p.position ?? null,
          shirt_number: p.number ?? null,
          photo_url: p.photo ?? null,
          current_team_id: t.id,
        }));

      // Connus : on ne touche qu'au rattachement au club, qui est ce qui
      // change au mercato. Les colonnes absentes de l'objet ne sont pas
      // écrasées, donc les données Football-Data (date de naissance,
      // nationalité, taille…) survivent.
      //
      // `name` est réécrit à l'identique : la colonne est obligatoire pour un
      // upsert, mais reprendre le nom déjà en base évite de remplacer une
      // graphie Football-Data par celle d'API-Football sur un joueur suivi
      // dans les deux compétitions.
      const updates = unique
        .filter((p) => afToDb.has(p.player_id))
        .map((p) => {
          const existing = afToDb.get(p.player_id)!;
          return {
            id: existing.id,
            name: existing.name,
            current_team_id: t.id,
          };
        });

      for (const rows of [inserts, updates]) {
        if (rows.length === 0) continue;
        const { error } = await supabase
          .from('players')
          .upsert(rows, { onConflict: 'id' });
        if (error) throw new Error(error.message);
      }

      stats.players += unique.length;
      stats.teams_done += 1;
    } catch (e) {
      stats.errors.push(
        `${t.name}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return stats;
}
