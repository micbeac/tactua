// Helper haut niveau : prend un match_id Football-Data depuis notre DB et
// l'enrichit avec lineups + match stats + player stats via API-Football.
//
// Stratégie de matching :
// - On charge le match Football-Data depuis Supabase (kickoff_at + noms d'équipes)
// - On cherche les fixtures API-Football à la date du kickoff
// - On filtre par concordance approximative de nom (normalisé) des 2 équipes
// - On récupère le fixture_id API-Football, on appelle lineups + stats + players

import type { SupabaseClient } from '@supabase/supabase-js';
import { createApiFootballClient } from './client.ts';
import {
  mapApiFootballLineups,
  mapApiFootballPlayerStats,
  mapApiFootballTeamStats,
} from './mappers.ts';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type EnrichResult = {
  match_id: number;
  fixture_id: number | null;
  lineups_upserted: number;
  team_stats_upserted: number;
  player_stats_upserted: number;
  players_upserted: number;
  notes: string[];
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*(fc|cf|sc|ac|fk|club|football club)\s*/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  // Tolère les inclusions partielles (ex "Real Madrid" vs "Real Madrid CF")
  return na.includes(nb) || nb.includes(na);
}

export async function enrichMatchFromApiFootball(
  supabase: Supa,
  matchId: number,
): Promise<EnrichResult> {
  const result: EnrichResult = {
    match_id: matchId,
    fixture_id: null,
    lineups_upserted: 0,
    team_stats_upserted: 0,
    player_stats_upserted: 0,
    players_upserted: 0,
    notes: [],
  };

  // 1. Charger le match
  const { data: match, error } = await supabase
    .from('matches')
    .select(
      `id, kickoff_at, home_team_id, away_team_id,
       home_team:teams!matches_home_team_id_fkey(id, name),
       away_team:teams!matches_away_team_id_fkey(id, name)`,
    )
    .eq('id', matchId)
    .single();
  if (error || !match) {
    result.notes.push('Match introuvable');
    return result;
  }

  type LoadedMatch = {
    id: number;
    kickoff_at: string;
    home_team_id: number | null;
    away_team_id: number | null;
    home_team: { id: number; name: string } | null;
    away_team: { id: number; name: string } | null;
  };
  const m = match as unknown as LoadedMatch;

  if (!m.home_team || !m.away_team) {
    result.notes.push('Équipes TBD');
    return result;
  }

  // 2. Chercher le fixture API-Football à la date du match (UTC)
  const client = createApiFootballClient();
  const date = m.kickoff_at.slice(0, 10);
  const search = await client.searchFixturesByDate(date);

  const fixture = search.response.find(
    (f) =>
      namesMatch(f.teams.home.name, m.home_team!.name) &&
      namesMatch(f.teams.away.name, m.away_team!.name),
  );

  if (!fixture) {
    result.notes.push(
      `Aucun fixture API-Football trouvé le ${date} pour ${m.home_team.name} vs ${m.away_team.name}`,
    );
    return result;
  }

  result.fixture_id = fixture.fixture.id;
  const teamIdMap = new Map<number, number>([
    [fixture.teams.home.id, m.home_team.id],
    [fixture.teams.away.id, m.away_team.id],
  ]);

  // 3. Lineups
  try {
    const lineupsResp = await client.getLineups(fixture.fixture.id);
    if (lineupsResp.response.length > 0) {
      const { lineups, players } = mapApiFootballLineups(
        lineupsResp,
        m.id,
        teamIdMap,
      );

      if (players.length > 0) {
        const { error: pErr } = await supabase
          .from('players')
          .upsert(players, { onConflict: 'id' });
        if (pErr) throw new Error(`players upsert: ${pErr.message}`);
        result.players_upserted = players.length;
      }

      if (lineups.length > 0) {
        const { error: lErr } = await supabase
          .from('match_lineups')
          .upsert(lineups, {
            onConflict: 'match_id,team_id,player_id,is_confirmed',
          });
        if (lErr) throw new Error(`match_lineups upsert: ${lErr.message}`);
        result.lineups_upserted = lineups.length;
      }
    } else {
      result.notes.push('Lineups vides côté API-Football');
    }
  } catch (e) {
    result.notes.push(`Lineups: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 4. Team stats
  try {
    const statsResp = await client.getTeamStats(fixture.fixture.id);
    if (statsResp.response.length > 0) {
      const rows = mapApiFootballTeamStats(statsResp, m.id, teamIdMap);
      if (rows.length > 0) {
        const { error: sErr } = await supabase
          .from('match_team_stats')
          .upsert(rows, { onConflict: 'match_id,team_id' });
        if (sErr) throw new Error(`match_team_stats upsert: ${sErr.message}`);
        result.team_stats_upserted = rows.length;
      }
    } else {
      result.notes.push('Team stats vides côté API-Football');
    }
  } catch (e) {
    result.notes.push(
      `Team stats: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // 5. Player stats
  try {
    const playersResp = await client.getPlayerStats(fixture.fixture.id);
    if (playersResp.response.length > 0) {
      const rows = mapApiFootballPlayerStats(playersResp, m.id);
      if (rows.length > 0) {
        // FK match_player_stats.player_id → public.players. On a déjà upsert
        // les joueurs des lineups ci-dessus, mais certains joueurs présents
        // dans les player stats peuvent ne pas être dans le startXI.
        // On les upsert au passage.
        const playerIds = Array.from(new Set(rows.map((r) => r.player_id)));
        const newPlayers = playersResp.response.flatMap((t) =>
          t.players
            .filter((p) => playerIds.includes(p.player.id))
            .map((p) => ({
              id: p.player.id,
              name: p.player.name,
              position: p.statistics[0]?.games.position ?? null,
              current_team_id: teamIdMap.get(t.team.id) ?? null,
            })),
        );
        // Dédoublonner par id
        const playersToUpsert = Array.from(
          new Map(newPlayers.map((p) => [p.id, p])).values(),
        );
        if (playersToUpsert.length > 0) {
          const { error: pErr } = await supabase
            .from('players')
            .upsert(playersToUpsert, { onConflict: 'id' });
          if (pErr)
            throw new Error(`players upsert (for stats): ${pErr.message}`);
        }

        const { error: psErr } = await supabase
          .from('match_player_stats')
          .upsert(rows, { onConflict: 'match_id,player_id' });
        if (psErr)
          throw new Error(`match_player_stats upsert: ${psErr.message}`);
        result.player_stats_upserted = rows.length;
      }
    } else {
      result.notes.push('Player stats vides côté API-Football');
    }
  } catch (e) {
    result.notes.push(
      `Player stats: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  return result;
}
