// Worker qui envoie les emails de notification pour un event donné.
// Trouve les destinataires (users avec le match ou une équipe en favoris),
// dédoublonne via notification_log, envoie via Resend, log le résultat.

import type { SupabaseClient } from '@supabase/supabase-js';
import { FROM, getResend } from '@/lib/emails/client';
import {
  buildFinalScoreEmail,
  buildKickoffEmail,
  buildLineupConfirmedEmail,
} from '@/lib/emails/templates';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type NotificationEvent = 'lineup_confirmed' | 'kickoff' | 'final_score';

export type DispatchResult = {
  match_id: number;
  event_type: NotificationEvent;
  candidates: number;
  sent: number;
  skipped_already_sent: number;
  errors: Array<{ user_id: string; message: string }>;
};

type MatchForEmail = {
  id: number;
  home_team_id: number | null;
  away_team_id: number | null;
  kickoff_at: string;
  score_home: number | null;
  score_away: number | null;
  competition: { name: string } | null;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
};

async function loadMatch(
  supabase: Supa,
  matchId: number,
): Promise<MatchForEmail | null> {
  const { data, error } = await supabase
    .from('matches')
    .select(
      `id, home_team_id, away_team_id, kickoff_at, score_home, score_away,
       competition:competitions(name),
       home_team:teams!matches_home_team_id_fkey(name),
       away_team:teams!matches_away_team_id_fkey(name)`,
    )
    .eq('id', matchId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as MatchForEmail;
}

/** Profils utilisateurs (avec email auth) qui ont ce match ou une de ses équipes en favoris. */
async function loadRecipients(
  supabase: Supa,
  match: MatchForEmail,
): Promise<Array<{ user_id: string; email: string }>> {
  const teamIds = [match.home_team_id, match.away_team_id].filter(
    (x): x is number => x != null,
  );

  // 1) Users avec ce match en favoris
  const { data: byMatch } = await supabase
    .from('user_favorites')
    .select('user_id')
    .eq('entity_type', 'match')
    .eq('entity_id', match.id);

  // 2) Users avec une des équipes en favoris
  const teamUserIds: string[] = [];
  if (teamIds.length > 0) {
    const { data: byTeam } = await supabase
      .from('user_favorites')
      .select('user_id')
      .eq('entity_type', 'team')
      .in('entity_id', teamIds);
    for (const r of byTeam ?? []) teamUserIds.push(r.user_id);
  }

  const userIds = Array.from(
    new Set([...(byMatch ?? []).map((r) => r.user_id), ...teamUserIds]),
  );
  if (userIds.length === 0) return [];

  // 3) Récupérer les emails via auth.users (uniquement accessible via service_role).
  // On utilise admin.listUsers + filtre, ou idéalement un RPC. Ici on fait simple :
  // on récupère les profils + on join via admin.getUserById pour chaque (coût ok pour
  // les volumes attendus en MVP).
  const recipients: Array<{ user_id: string; email: string }> = [];
  for (const userId of userIds) {
    const { data, error } = await (
      supabase as unknown as {
        auth: {
          admin: {
            getUserById: (id: string) => Promise<{
              data: { user: { email?: string | null } | null };
              error: unknown;
            }>;
          };
        };
      }
    ).auth.admin.getUserById(userId);
    if (error || !data?.user?.email) continue;
    recipients.push({ user_id: userId, email: data.user.email });
  }
  return recipients;
}

async function alreadySent(
  supabase: Supa,
  userId: string,
  matchId: number,
  event: NotificationEvent,
): Promise<boolean> {
  const { data } = await supabase
    .from('notification_log')
    .select('id')
    .eq('user_id', userId)
    .eq('match_id', matchId)
    .eq('event_type', event)
    .maybeSingle();
  return Boolean(data);
}

export async function dispatchEvent(
  supabase: Supa,
  matchId: number,
  event: NotificationEvent,
): Promise<DispatchResult> {
  const result: DispatchResult = {
    match_id: matchId,
    event_type: event,
    candidates: 0,
    sent: 0,
    skipped_already_sent: 0,
    errors: [],
  };

  const match = await loadMatch(supabase, matchId);
  if (!match) return result;

  const recipients = await loadRecipients(supabase, match);
  result.candidates = recipients.length;
  if (recipients.length === 0) return result;

  const matchInfo = {
    id: match.id,
    home_team_name: match.home_team?.name ?? 'Domicile',
    away_team_name: match.away_team?.name ?? 'Extérieur',
    competition_name: match.competition?.name ?? null,
    kickoff_at: match.kickoff_at,
    score_home: match.score_home,
    score_away: match.score_away,
  };

  const email =
    event === 'lineup_confirmed'
      ? buildLineupConfirmedEmail(matchInfo)
      : event === 'kickoff'
        ? buildKickoffEmail(matchInfo)
        : buildFinalScoreEmail(matchInfo);

  const resend = getResend();

  for (const r of recipients) {
    if (await alreadySent(supabase, r.user_id, matchId, event)) {
      result.skipped_already_sent += 1;
      continue;
    }

    try {
      const { error } = await resend.emails.send({
        from: FROM,
        to: r.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      const status = error ? 'failed' : 'sent';
      const { error: logErr } = await supabase.from('notification_log').insert({
        user_id: r.user_id,
        match_id: matchId,
        event_type: event,
        email_status: status,
      });
      if (logErr) {
        // log erreur mais ne pas faire échouer l'envoi
        console.error('[notif] log insert error', logErr);
      }
      if (error) {
        result.errors.push({
          user_id: r.user_id,
          message: error.message ?? 'unknown',
        });
      } else {
        result.sent += 1;
      }
    } catch (e) {
      result.errors.push({
        user_id: r.user_id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}
