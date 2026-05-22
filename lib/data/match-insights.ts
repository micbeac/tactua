// Insights calculés 100% depuis notre base (aucun appel API) :
//  - composition probable (XI le plus utilisé récemment)
//  - profil de l'arbitre (cartons/match)
//  - tendance de forme des joueurs (notes récentes)

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

// ============================================================================
// A. Composition probable — XI le plus utilisé sur les derniers matchs
// ============================================================================

export type ProbableLineupPlayer = {
  player_id: number;
  player_name: string;
  position: string | null;
  shirt_number: number | null;
  starts: number; // titularisations sur l'échantillon
};

export type ProbableLineup = {
  sample: number; // nombre de matchs analysés
  players: ProbableLineupPlayer[]; // jusqu'à 11
};

/**
 * Déduit le XI probable d'une équipe depuis l'historique des compositions
 * officielles de ses derniers matchs joués (avant `beforeIso`).
 */
export async function getProbableLineup(
  supabase: Supa,
  teamId: number,
  beforeIso: string,
  lookback = 6,
): Promise<ProbableLineup | null> {
  const { data: recent } = await supabase
    .from('matches')
    .select('id')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq('status', 'finished')
    .lt('kickoff_at', beforeIso)
    .order('kickoff_at', { ascending: false })
    .limit(lookback);

  const matchIds = (recent ?? []).map((m) => (m as { id: number }).id);
  if (matchIds.length === 0) return null;

  const { data: lineups } = await supabase
    .from('match_lineups')
    .select('player_id, position, shirt_number, player:players(name)')
    .in('match_id', matchIds)
    .eq('team_id', teamId)
    .eq('is_starter', true)
    .eq('is_confirmed', true);

  type Row = {
    player_id: number;
    position: string | null;
    shirt_number: number | null;
    player: { name: string } | null;
  };
  const rows = (lineups ?? []) as unknown as Row[];
  if (rows.length === 0) return null;

  const agg = new Map<number, ProbableLineupPlayer>();
  for (const r of rows) {
    const cur = agg.get(r.player_id);
    if (cur) {
      cur.starts += 1;
      if (cur.position == null && r.position) cur.position = r.position;
      if (cur.shirt_number == null && r.shirt_number != null) {
        cur.shirt_number = r.shirt_number;
      }
    } else {
      agg.set(r.player_id, {
        player_id: r.player_id,
        player_name: r.player?.name ?? `Joueur #${r.player_id}`,
        position: r.position,
        shirt_number: r.shirt_number,
        starts: 1,
      });
    }
  }

  const players = Array.from(agg.values())
    .sort((a, b) => b.starts - a.starts || a.player_name.localeCompare(b.player_name))
    .slice(0, 11)
    .sort((a, b) => (a.shirt_number ?? 99) - (b.shirt_number ?? 99));

  return { sample: matchIds.length, players };
}

// ============================================================================
// B. Profil de l'arbitre — cartons par match
// ============================================================================

export type RefereeProfile = {
  name: string;
  matches: number;
  yellow_per_match: number;
  red_per_match: number;
};

/**
 * Profil disciplinaire d'un arbitre, agrégé depuis nos matchs finis.
 * Renvoie null si moins de 3 matchs en base (échantillon trop faible).
 */
export async function getRefereeProfile(
  supabase: Supa,
  refereeName: string | null,
): Promise<RefereeProfile | null> {
  if (!refereeName || refereeName.trim().length === 0) return null;

  const { data: refMatches } = await supabase
    .from('matches')
    .select('id')
    .eq('referee', refereeName)
    .eq('status', 'finished');

  const ids = (refMatches ?? []).map((m) => (m as { id: number }).id);
  if (ids.length < 3) return null;

  const { data: events } = await supabase
    .from('match_events')
    .select('detail')
    .in('match_id', ids)
    .eq('type', 'card');

  let yellow = 0;
  let red = 0;
  for (const e of (events ?? []) as Array<{ detail: string | null }>) {
    const d = (e.detail ?? '').toLowerCase();
    if (d.includes('red')) red += 1;
    else if (d.includes('yellow')) yellow += 1;
  }

  return {
    name: refereeName,
    matches: ids.length,
    yellow_per_match: Math.round((yellow / ids.length) * 10) / 10,
    red_per_match: Math.round((red / ids.length) * 100) / 100,
  };
}

// ============================================================================
// C. Tendance de forme des joueurs — notes des derniers matchs
// ============================================================================

export type PlayerForm = {
  avg_rating: number;
  sample: number;
  trend: 'up' | 'down' | 'stable';
};

/**
 * Forme récente d'un lot de joueurs : moyenne de note sur leurs ~5
 * derniers matchs notés + tendance (compare la 1re moitié à la 2de).
 */
export async function getPlayersRecentForm(
  supabase: Supa,
  playerIds: number[],
  window = 5,
): Promise<Map<number, PlayerForm>> {
  const out = new Map<number, PlayerForm>();
  if (playerIds.length === 0) return out;

  const { data } = await supabase
    .from('match_player_stats')
    .select('player_id, rating, match:matches(kickoff_at)')
    .in('player_id', playerIds)
    .not('rating', 'is', null);

  type Row = {
    player_id: number;
    rating: number | null;
    match: { kickoff_at: string } | null;
  };
  const byPlayer = new Map<number, Array<{ rating: number; ts: number }>>();
  for (const r of (data ?? []) as unknown as Row[]) {
    if (r.rating == null || !r.match) continue;
    const list = byPlayer.get(r.player_id) ?? [];
    list.push({ rating: r.rating, ts: Date.parse(r.match.kickoff_at) });
    byPlayer.set(r.player_id, list);
  }

  for (const [pid, list] of byPlayer.entries()) {
    // Du plus récent au plus ancien, on garde la fenêtre
    list.sort((a, b) => b.ts - a.ts);
    const win = list.slice(0, window);
    if (win.length < 3) continue; // échantillon trop faible

    const avg =
      win.reduce((s, x) => s + x.rating, 0) / win.length;
    // Tendance : moyenne des plus récents vs des plus anciens de la fenêtre
    const half = Math.floor(win.length / 2);
    const recentAvg =
      win.slice(0, half).reduce((s, x) => s + x.rating, 0) / half;
    const olderAvg =
      win.slice(win.length - half).reduce((s, x) => s + x.rating, 0) / half;
    let trend: PlayerForm['trend'] = 'stable';
    if (recentAvg - olderAvg >= 0.3) trend = 'up';
    else if (olderAvg - recentAvg >= 0.3) trend = 'down';

    out.set(pid, {
      avg_rating: Math.round(avg * 100) / 100,
      sample: win.length,
      trend,
    });
  }

  return out;
}
