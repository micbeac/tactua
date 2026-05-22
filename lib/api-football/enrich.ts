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
  events_upserted: number;
  players_upserted: number;
  live_minute: number | null;
  live_status: string | null;
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

/**
 * Mappe un code statut API-Football (status.short) vers notre enum interne.
 * Renvoie null si le code est inconnu (on ne touche pas au statut alors).
 */
function mapAfStatus(
  short: string,
): 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' | null {
  switch (short) {
    case 'NS':
    case 'TBD':
      return 'scheduled';
    case '1H':
    case 'HT':
    case '2H':
    case 'ET':
    case 'BT':
    case 'P':
    case 'LIVE':
    case 'INT':
      return 'live';
    case 'FT':
    case 'AET':
    case 'PEN':
    case 'AWD': // victoire sur tapis — il y a un résultat
    case 'WO': // walkover
      return 'finished';
    case 'PST':
    case 'SUSP':
      return 'postponed';
    case 'CANC':
    case 'ABD':
      return 'cancelled';
    default:
      return null;
  }
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
    events_upserted: 0,
    players_upserted: 0,
    live_minute: null,
    live_status: null,
    notes: [],
  };

  // 1. Charger le match (avec fixture_id pré-mappé et IDs AF des équipes)
  const { data: match, error } = await supabase
    .from('matches')
    .select(
      `id, kickoff_at, home_team_id, away_team_id, api_football_fixture_id,
       home_team:teams!matches_home_team_id_fkey(id, name, api_football_id),
       away_team:teams!matches_away_team_id_fkey(id, name, api_football_id)`,
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
    api_football_fixture_id: number | null;
    home_team: { id: number; name: string; api_football_id: number | null } | null;
    away_team: { id: number; name: string; api_football_id: number | null } | null;
  };
  const m = match as unknown as LoadedMatch;

  if (!m.home_team || !m.away_team) {
    result.notes.push('Équipes TBD');
    return result;
  }

  // 2. Récupérer le fixture API-Football.
  // Voie rapide : api_football_fixture_id pré-mappé (résolu par
  // resolve-fixture-ids). Voie de secours : recherche par date + nom.
  const client = createApiFootballClient();
  let afFixtureId: number | null = m.api_football_fixture_id;
  let afHomeId: number | null = m.home_team.api_football_id;
  let afAwayId: number | null = m.away_team.api_football_id;

  if (!afFixtureId) {
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
    afFixtureId = fixture.fixture.id;
    afHomeId = fixture.teams.home.id;
    afAwayId = fixture.teams.away.id;
  }

  if (!afHomeId || !afAwayId) {
    result.notes.push('Équipes sans api_football_id');
    return result;
  }

  result.fixture_id = afFixtureId;
  const teamIdMap = new Map<number, number>([
    [afHomeId, m.home_team.id],
    [afAwayId, m.away_team.id],
  ]);

  // 3. Précharger le mapping AF→DB des joueurs des 2 équipes.
  // Évite de dupliquer un joueur déjà connu en DB avec un autre id.
  const playerIdMap = new Map<number, number>();
  const { data: dbPlayers } = await supabase
    .from('players')
    .select('id, api_football_id')
    .or(
      `current_team_id.eq.${m.home_team.id},current_team_id.eq.${m.away_team.id}`,
    )
    .not('api_football_id', 'is', null);
  for (const p of (dbPlayers ?? []) as Array<{
    id: number;
    api_football_id: number;
  }>) {
    playerIdMap.set(p.api_football_id, p.id);
  }

  // 4. Lineups
  try {
    const lineupsResp = await client.getLineups(afFixtureId);
    if (lineupsResp.response.length > 0) {
      // Résout TOUS les joueurs de la feuille de match par api_football_id,
      // sans filtre current_team_id. Indispensable : un joueur transféré (ou
      // dont current_team_id ne pointe plus sur l'une des 2 équipes) existe
      // déjà en DB sous un autre id — le réinsérer violerait l'index unique
      // players_api_football_id_uidx et ferait échouer tout le batch.
      const afPlayerIds = new Set<number>();
      for (const team of lineupsResp.response) {
        for (const it of [...team.startXI, ...team.substitutes]) {
          if (it.player?.id != null) afPlayerIds.add(it.player.id);
        }
      }
      if (afPlayerIds.size > 0) {
        const { data: known } = await supabase
          .from('players')
          .select('id, api_football_id')
          .in('api_football_id', [...afPlayerIds]);
        for (const p of (known ?? []) as Array<{
          id: number;
          api_football_id: number;
        }>) {
          playerIdMap.set(p.api_football_id, p.id);
        }
      }

      const { lineups, players } = mapApiFootballLineups(
        lineupsResp,
        m.id,
        teamIdMap,
        playerIdMap,
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

  // 5. Team stats
  try {
    const statsResp = await client.getTeamStats(afFixtureId);
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

  // 6.bis Events (timeline) + fixture detail (status / score / live minute)
  // Fait avant les player stats car même endpoint /fixtures et bcp moins lourd.
  try {
    const detailResp = await client.getFixtureDetail(afFixtureId);
    const fix = detailResp.response[0];
    if (fix) {
      result.live_status = fix.fixture.status.short;
      result.live_minute = fix.fixture.status.elapsed;
      // Update matches : statut + score + minute live.
      // Indispensable — sinon un match joué reste 'scheduled' sans score
      // tant qu'aucun refresh Football-Data n'est passé.
      const update: {
        live_minute: number | null;
        live_updated_at: string;
        status?: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
        score_home?: number;
        score_away?: number;
      } = {
        live_minute: fix.fixture.status.elapsed,
        live_updated_at: new Date().toISOString(),
      };
      const mapped = mapAfStatus(fix.fixture.status.short);
      if (mapped) update.status = mapped;
      if (fix.goals.home != null) update.score_home = fix.goals.home;
      if (fix.goals.away != null) update.score_away = fix.goals.away;

      const { error: mErr } = await supabase
        .from('matches')
        .update(update)
        .eq('id', m.id);
      if (mErr) {
        result.notes.push(`Match status/score update: ${mErr.message}`);
      }
    }
  } catch (e) {
    result.notes.push(
      `Fixture detail: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  try {
    const eventsResp = await client.getEvents(afFixtureId);
    if (eventsResp.response.length > 0) {
      // Mappe : AF team_id → DB team_id, AF player_id → DB player_id
      type AFEvent = (typeof eventsResp.response)[number];
      const rows = eventsResp.response
        .map((e: AFEvent) => {
          const teamDbId = teamIdMap.get(e.team.id) ?? null;
          const playerDbId =
            e.player.id != null ? (playerIdMap.get(e.player.id) ?? null) : null;
          const assistDbId =
            e.assist.id != null ? (playerIdMap.get(e.assist.id) ?? null) : null;
          return {
            match_id: m.id,
            team_id: teamDbId,
            player_id: playerDbId,
            assist_player_id: assistDbId,
            minute: e.time.elapsed,
            extra_minute: e.time.extra,
            type: e.type.toLowerCase(), // 'goal', 'card', 'subst', 'var'
            detail: e.detail,
            comments: e.comments,
          };
        })
        // Filtre les events sans minute (cas rare mais existe)
        .filter((r) => r.minute != null);

      if (rows.length > 0) {
        const { error: evErr } = await supabase
          .from('match_events')
          .upsert(rows, {
            onConflict: 'match_id,minute,type,player_id,team_id,detail',
            ignoreDuplicates: true,
          });
        if (evErr) throw new Error(`match_events upsert: ${evErr.message}`);
        result.events_upserted = rows.length;
      }
    }
  } catch (e) {
    result.notes.push(`Events: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 7. Player stats
  try {
    const playersResp = await client.getPlayerStats(afFixtureId);
    if (playersResp.response.length > 0) {
      const { rows, players: newPlayers } = mapApiFootballPlayerStats(
        playersResp,
        m.id,
        teamIdMap,
        playerIdMap,
      );

      if (newPlayers.length > 0) {
        const { error: pErr } = await supabase
          .from('players')
          .upsert(newPlayers, { onConflict: 'id' });
        if (pErr)
          throw new Error(`players upsert (for stats): ${pErr.message}`);
        result.players_upserted += newPlayers.length;
      }

      if (rows.length > 0) {
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
