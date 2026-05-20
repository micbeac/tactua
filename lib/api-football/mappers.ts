// Mappers API-Football → tables Supabase.
// Convention : on garde nos IDs Football-Data sur teams/matches/players (PK
// connue), donc les mappers reçoivent l'ID DB en paramètre quand l'API-Football
// ne le connaît pas. Pour les joueurs/équipes inconnus de notre DB, on les
// upsert au passage (id = api-football id, pour les nouveaux).

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

/**
 * Aplatit la réponse `/fixtures/lineups` en lignes match_lineups.
 * `teamIdMap` matche team api-football → team_id en base (= team_id Football-Data).
 * Les joueurs sont retournés à part pour upsert avant insertion des lineups
 * (FK vers public.players).
 */
export function mapApiFootballLineups(
  resp: AFLineupsResponse,
  matchId: number,
  teamIdMap: Map<number, number>,
): { lineups: MatchLineupInsert[]; players: PlayerInsert[] } {
  const lineups: MatchLineupInsert[] = [];
  const players: PlayerInsert[] = [];
  const seenPlayers = new Set<number>();

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
        if (!seenPlayers.has(p.id)) {
          players.push({
            id: p.id,
            name: p.name,
            position: p.pos,
            current_team_id: dbTeamId,
          });
          seenPlayers.add(p.id);
        }
        lineups.push({
          match_id: matchId,
          team_id: dbTeamId,
          player_id: p.id,
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
    });
  }
  return rows;
}

/** `/fixtures/players` → match_player_stats (1 ligne par joueur ayant joué). */
export function mapApiFootballPlayerStats(
  resp: AFPlayerStatsResponse,
  matchId: number,
): MatchPlayerStatsInsert[] {
  const rows: MatchPlayerStatsInsert[] = [];
  for (const t of resp.response) {
    for (const p of t.players) {
      const s = p.statistics[0];
      if (!s || s.games.minutes == null) continue;
      const rating = s.games.rating ? Number(s.games.rating) : null;
      rows.push({
        match_id: matchId,
        player_id: p.player.id,
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
  return rows;
}
