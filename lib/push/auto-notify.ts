// Détection + envoi des push automatiques après un tick du cron refresh-matchday.
// Cherche :
//   1. Les nouveaux goals (match_events.pushed_at IS NULL AND type='goal')
//   2. Les nouvelles compos confirmées (match_lineups.is_confirmed=true AND pushed_at IS NULL)
// Pour chaque trigger, identifie les users concernés (favoris match/équipe)
// et envoie une push.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { sendPushToUsers, type BulkPushResult } from './send-bulk';
import { SITE_URL } from '@/lib/site';

type Supa = SupabaseClient<Database>;

export type AutoNotifyStats = {
  goals_pushed: number;
  goals_recipients: BulkPushResult;
  lineups_pushed: number;
  lineups_recipients: BulkPushResult;
};

/**
 * Récupère les user_ids qui suivent un match donné (favori match)
 * OU une des 2 équipes (favori team).
 */
async function getInterestedUserIds(
  supabase: Supa,
  matchId: number,
  homeTeamId: number | null,
  awayTeamId: number | null,
): Promise<string[]> {
  const ids = new Set<string>();

  // 1. Favoris match
  const { data: matchFavs } = await supabase
    .from('user_favorites')
    .select('user_id')
    .eq('entity_type', 'match')
    .eq('entity_id', matchId);
  for (const f of (matchFavs ?? []) as { user_id: string }[]) {
    ids.add(f.user_id);
  }

  // 2. Favoris team
  const teamIds = [homeTeamId, awayTeamId].filter(
    (t): t is number => t != null,
  );
  if (teamIds.length > 0) {
    const { data: teamFavs } = await supabase
      .from('user_favorites')
      .select('user_id')
      .eq('entity_type', 'team')
      .in('entity_id', teamIds);
    for (const f of (teamFavs ?? []) as { user_id: string }[]) {
      ids.add(f.user_id);
    }
  }

  return Array.from(ids);
}

export async function autoNotifyAfterTick(
  supabase: Supa,
): Promise<AutoNotifyStats> {
  const stats: AutoNotifyStats = {
    goals_pushed: 0,
    goals_recipients: {
      attempted: 0,
      sent: 0,
      failed: 0,
      expired_removed: 0,
    },
    lineups_pushed: 0,
    lineups_recipients: {
      attempted: 0,
      sent: 0,
      failed: 0,
      expired_removed: 0,
    },
  };

  // ============================================================
  // 1. Goals non encore poussés
  // ============================================================
  const { data: goalsRaw } = await supabase
    .from('match_events')
    .select(
      `id, match_id, team_id, minute, extra_minute, type, detail, player_id,
       player:players!match_events_player_id_fkey(name),
       match:matches!match_events_match_id_fkey(
         id, score_home, score_away, home_team_id, away_team_id,
         home_team:teams!matches_home_team_id_fkey(id, name, tla),
         away_team:teams!matches_away_team_id_fkey(id, name, tla)
       )`,
    )
    .eq('type', 'goal')
    .is('pushed_at', null)
    .order('id', { ascending: true })
    .limit(50);

  type GoalRow = {
    id: number;
    match_id: number;
    team_id: number | null;
    minute: number | null;
    extra_minute: number | null;
    type: string;
    detail: string | null;
    player_id: number | null;
    player: { name: string } | null;
    match: {
      id: number;
      score_home: number | null;
      score_away: number | null;
      home_team_id: number | null;
      away_team_id: number | null;
      home_team: { id: number; name: string; tla: string | null } | null;
      away_team: { id: number; name: string; tla: string | null } | null;
    } | null;
  };
  const goals = (goalsRaw ?? []) as unknown as GoalRow[];

  for (const goal of goals) {
    if (!goal.match) continue;
    const m = goal.match;
    const isHome = goal.team_id === m.home_team_id;
    const scoringTeam = isHome ? m.home_team : m.away_team;
    const otherTeam = isHome ? m.away_team : m.home_team;
    const teamName = scoringTeam?.name ?? 'Équipe';
    const scoreLine =
      m.score_home != null && m.score_away != null
        ? `${m.home_team?.tla ?? 'DOM'} ${m.score_home} - ${m.score_away} ${m.away_team?.tla ?? 'EXT'}`
        : '';
    const minute =
      goal.minute != null
        ? `${goal.minute}${goal.extra_minute ? `+${goal.extra_minute}` : ''}'`
        : '';
    const playerName = goal.player?.name ?? 'Inconnu';
    const isOwn = (goal.detail ?? '').toLowerCase().includes('own');
    const isPenalty = (goal.detail ?? '').toLowerCase().includes('penalty');

    const title = `⚽️ But ${teamName} ${minute}`;
    const body = isOwn
      ? `CSC contre ${otherTeam?.name ?? '?'} · ${scoreLine}`
      : `${playerName}${isPenalty ? ' (pen)' : ''} · ${scoreLine}`;

    const userIds = await getInterestedUserIds(
      supabase,
      m.id,
      m.home_team_id,
      m.away_team_id,
    );

    if (userIds.length > 0) {
      const r = await sendPushToUsers(supabase, userIds, 'goal', {
        title,
        body,
        url: `${SITE_URL}/matches/${m.id}`,
        tag: `goal-${m.id}-${goal.id}`,
        icon: '/favicon.png',
        data: { match_id: m.id },
      });
      stats.goals_recipients.attempted += r.attempted;
      stats.goals_recipients.sent += r.sent;
      stats.goals_recipients.failed += r.failed;
      stats.goals_recipients.expired_removed += r.expired_removed;
    }

    await supabase
      .from('match_events')
      .update({ pushed_at: new Date().toISOString() })
      .eq('id', goal.id);
    stats.goals_pushed += 1;
  }

  // ============================================================
  // 2. Compositions confirmées non encore poussées
  // ============================================================
  // On cherche les match_ids qui ont au moins 1 lineup is_confirmed=true ET
  // dont aucune lineup n'a encore été pushée (= première confirmation pour ce match)
  const { data: lineupCandidates } = await supabase
    .from('match_lineups')
    .select('match_id')
    .eq('is_confirmed', true)
    .is('pushed_at', null)
    .limit(200);

  const matchIdsForLineup = Array.from(
    new Set((lineupCandidates ?? []).map((r) => r.match_id)),
  );

  for (const matchId of matchIdsForLineup) {
    // Vérifie qu'il n'y a pas DEJA eu un push pour ce match
    const { data: alreadyPushed } = await supabase
      .from('match_lineups')
      .select('id')
      .eq('match_id', matchId)
      .eq('is_confirmed', true)
      .not('pushed_at', 'is', null)
      .limit(1);
    if ((alreadyPushed ?? []).length > 0) {
      // Déjà notifié : on marque les lineups restantes pour ne pas re-déclencher
      await supabase
        .from('match_lineups')
        .update({ pushed_at: new Date().toISOString() })
        .eq('match_id', matchId)
        .eq('is_confirmed', true);
      continue;
    }

    const { data: matchData } = await supabase
      .from('matches')
      .select(
        `id, home_team_id, away_team_id,
         home_team:teams!matches_home_team_id_fkey(name),
         away_team:teams!matches_away_team_id_fkey(name)`,
      )
      .eq('id', matchId)
      .maybeSingle();
    type MatchRow = {
      id: number;
      home_team_id: number | null;
      away_team_id: number | null;
      home_team: { name: string } | null;
      away_team: { name: string } | null;
    };
    const m = matchData as unknown as MatchRow | null;
    if (!m) continue;

    const homeName = m.home_team?.name ?? 'Domicile';
    const awayName = m.away_team?.name ?? 'Extérieur';
    const title = `🏟️ Compo officielle`;
    const body = `${homeName} vs ${awayName} — analyse IA dispo`;

    const userIds = await getInterestedUserIds(
      supabase,
      m.id,
      m.home_team_id,
      m.away_team_id,
    );

    if (userIds.length > 0) {
      const r = await sendPushToUsers(supabase, userIds, 'lineup_confirmed', {
        title,
        body,
        url: `${SITE_URL}/matches/${m.id}#analyse`,
        tag: `lineup-${m.id}`,
        icon: '/favicon.png',
        data: { match_id: m.id },
      });
      stats.lineups_recipients.attempted += r.attempted;
      stats.lineups_recipients.sent += r.sent;
      stats.lineups_recipients.failed += r.failed;
      stats.lineups_recipients.expired_removed += r.expired_removed;
    }

    // Marque toutes les lineups de ce match comme pushed
    await supabase
      .from('match_lineups')
      .update({ pushed_at: new Date().toISOString() })
      .eq('match_id', matchId)
      .eq('is_confirmed', true);
    stats.lineups_pushed += 1;
  }

  return stats;
}
