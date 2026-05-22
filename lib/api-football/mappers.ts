// Mappers API-Football → tables Supabase.
// Convention : nos IDs primaires viennent de Football-Data. Pour les
// enrichissements API-Football, on traduit l'AF player_id en DB id via
// players.api_football_id. Si un joueur AF n'existe pas en DB, on l'insère
// avec id = af_player_id et api_football_id = af_player_id (l'ID AF sert
// de PK pour ce nouveau row, et la colonne api_football_id permet aux
// prochains enrichissements de le retrouver sans dupliquer).

import type { Database } from '@/types/database';
import type {
  AFLineupsResponse,
  AFPlayerStatsResponse,
  AFStatItem,
  AFTeamStatsResponse,
} from './types';

type MatchLineupInsert =
  Database['public']['Tables']['match_lineups']['Insert'];
type MatchTeamStatsInsert =
  Database['public']['Tables']['match_team_stats']['Insert'];
type MatchPlayerStatsInsert =
  Database['public']['Tables']['match_player_stats']['Insert'];
type PlayerInsert = Database['public']['Tables']['players']['Insert'];

export type PlayerIdMap = Map<number, number>; // AF player_id → DB players.id

/**
 * Aplatit la réponse `/fixtures/lineups` en lignes match_lineups.
 *
 * `teamIdMap`   : team AF id → team_id DB
 * `playerIdMap` : player AF id → player_id DB (rempli en amont par enrichMatch)
 *
 * Pour un joueur AF sans entrée dans `playerIdMap`, on retourne un PlayerInsert
 * dans `players` à upserter par l'appelant (id = AF id, api_football_id = AF id).
 * Le map est mis à jour en place pour les appels suivants (player stats).
 */
export function mapApiFootballLineups(
  resp: AFLineupsResponse,
  matchId: number,
  teamIdMap: Map<number, number>,
  playerIdMap: PlayerIdMap,
): { lineups: MatchLineupInsert[]; players: PlayerInsert[] } {
  const lineups: MatchLineupInsert[] = [];
  const players: PlayerInsert[] = [];
  const seenNewPlayers = new Set<number>();

  for (const team of resp.response) {
    const dbTeamId = teamIdMap.get(team.team.id);
    if (!dbTeamId) continue;

    const collect = (
      list: {
        player: {
          id: number;
          name: string;
          number: number | null;
          pos: string | null;
        };
      }[],
      isStarter: boolean,
    ) => {
      for (const item of list) {
        const p = item.player;
        let dbPlayerId = playerIdMap.get(p.id);
        if (!dbPlayerId) {
          // Inconnu en DB : on l'insère avec AF id comme PK.
          dbPlayerId = p.id;
          if (!seenNewPlayers.has(p.id)) {
            players.push({
              id: p.id,
              api_football_id: p.id,
              name: p.name,
              position: p.pos,
              current_team_id: dbTeamId,
            });
            seenNewPlayers.add(p.id);
            playerIdMap.set(p.id, p.id);
          }
        }
        lineups.push({
          match_id: matchId,
          team_id: dbTeamId,
          player_id: dbPlayerId,
          position: p.pos,
          shirt_number: p.number,
          is_starter: isStarter,
          is_confirmed: true,
        });
      }
    };

    collect(team.startXI, true);
    collect(team.substitutes, false);
  }

  return { lineups, players };
}

function parsePercentage(v: number | string | null): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const m = v.match(/(-?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function parseNumber(v: number | string | null): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickStat(stats: AFStatItem[], type: string): number | string | null {
  return (
    stats.find((s) => s.type.toLowerCase() === type.toLowerCase())?.value ??
    null
  );
}

/** `/fixtures/statistics` → match_team_stats (2 lignes). */
export function mapApiFootballTeamStats(
  resp: AFTeamStatsResponse,
  matchId: number,
  teamIdMap: Map<number, number>,
): MatchTeamStatsInsert[] {
  const rows: MatchTeamStatsInsert[] = [];
  for (const t of resp.response) {
    const dbTeamId = teamIdMap.get(t.team.id);
    if (!dbTeamId) continue;
    rows.push({
      match_id: matchId,
      team_id: dbTeamId,
      possession: parsePercentage(pickStat(t.statistics, 'Ball Possession')),
      shots: parseNumber(pickStat(t.statistics, 'Total Shots')),
      shots_on_target: parseNumber(pickStat(t.statistics, 'Shots on Goal')),
      corners: parseNumber(pickStat(t.statistics, 'Corner Kicks')),
      fouls: parseNumber(pickStat(t.statistics, 'Fouls')),
      yellow_cards: parseNumber(pickStat(t.statistics, 'Yellow Cards')),
      red_cards: parseNumber(pickStat(t.statistics, 'Red Cards')),
      offsides: parseNumber(pickStat(t.statistics, 'Offsides')),
      expected_goals: parseNumber(pickStat(t.statistics, 'expected_goals')),
      goals_prevented: parseNumber(pickStat(t.statistics, 'goals_prevented')),
    });
  }
  return rows;
}

/**
 * `/fixtures/players` → match_player_stats (1 ligne par joueur ayant joué).
 *
 * `playerIdMap` traduit AF player_id → DB players.id. Pour les joueurs absents
 * du map, on retourne un PlayerInsert pour upsert avant insertion des stats
 * (FK). Le map est enrichi en place.
 */
export function mapApiFootballPlayerStats(
  resp: AFPlayerStatsResponse,
  matchId: number,
  teamIdMap: Map<number, number>,
  playerIdMap: PlayerIdMap,
): { rows: MatchPlayerStatsInsert[]; players: PlayerInsert[] } {
  const rows: MatchPlayerStatsInsert[] = [];
  const players: PlayerInsert[] = [];
  const seenNewPlayers = new Set<number>();

  for (const t of resp.response) {
    const dbTeamId = teamIdMap.get(t.team.id);
    for (const p of t.players) {
      const s = p.statistics[0];
      if (!s || s.games.minutes == null) continue;
      let dbPlayerId = playerIdMap.get(p.player.id);
      if (!dbPlayerId) {
        dbPlayerId = p.player.id;
        if (!seenNewPlayers.has(p.player.id)) {
          players.push({
            id: p.player.id,
            api_football_id: p.player.id,
            name: p.player.name,
            position: s.games.position ?? null,
            current_team_id: dbTeamId ?? null,
          });
          seenNewPlayers.add(p.player.id);
          playerIdMap.set(p.player.id, p.player.id);
        }
      }
      const rating = s.games.rating ? Number(s.games.rating) : null;
      rows.push({
        match_id: matchId,
        player_id: dbPlayerId,
        minutes_played: s.games.minutes,
        goals: s.goals.total ?? 0,
        assists: s.goals.assists ?? 0,
        shots: s.shots.total,
        passes: s.passes.total,
        key_passes: s.passes.key,
        yellow_card: (s.cards.yellow ?? 0) > 0,
        red_card: (s.cards.red ?? 0) > 0,
        rating: Number.isFinite(rating ?? NaN) ? rating : null,
      });
    }
  }
  return { rows, players };
}
