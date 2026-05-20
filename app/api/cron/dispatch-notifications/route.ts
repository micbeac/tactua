// Détecte les events de notification à envoyer et appelle le dispatcher.
// 3 events :
// - lineup_confirmed : un nouveau row match_lineups avec is_confirmed=true a été
//   inséré récemment (dernières 6h)
// - kickoff : matchs dont kickoff_at est dans la fenêtre [now-15min, now+5min]
// - final_score : matchs passés en `finished` au cours des dernières 2h
//
// La table notification_log dédoublonne (unique sur user/event/match).
//
// Auth : Authorization: Bearer ${CRON_SECRET}.
// Pas dans vercel.json (limite 2 cron sur Hobby) — à invoquer manuellement
// ou depuis refresh-matchday après upgrade Pro.

import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import {
  dispatchEvent,
  type DispatchResult,
  type NotificationEvent,
} from '@/lib/notifications/dispatcher';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const KICKOFF_WINDOW_BEFORE_MS = 15 * 60 * 1000;
const KICKOFF_WINDOW_AFTER_MS = 5 * 60 * 1000;
const FINISHED_WINDOW_MS = 2 * 60 * 60 * 1000;
const LINEUP_WINDOW_MS = 6 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();
  const now = Date.now();

  const events: Array<{ matchId: number; event: NotificationEvent }> = [];

  // 1) Kickoff : matchs dont le kickoff est dans la fenêtre [-15min, +5min]
  const koLower = new Date(now - KICKOFF_WINDOW_BEFORE_MS).toISOString();
  const koUpper = new Date(now + KICKOFF_WINDOW_AFTER_MS).toISOString();
  const { data: kickoffs } = await supabase
    .from('matches')
    .select('id')
    .gte('kickoff_at', koLower)
    .lte('kickoff_at', koUpper);
  for (const m of kickoffs ?? [])
    events.push({ matchId: m.id, event: 'kickoff' });

  // 2) Final score : matchs `finished` avec kickoff dans les 2h passées
  const finishedLower = new Date(now - FINISHED_WINDOW_MS).toISOString();
  const { data: finished } = await supabase
    .from('matches')
    .select('id')
    .eq('status', 'finished')
    .gte('kickoff_at', finishedLower);
  for (const m of finished ?? [])
    events.push({ matchId: m.id, event: 'final_score' });

  // 3) Lineup confirmed : matchs avec au moins une lineup is_confirmed=true
  //    créée dans les 6 dernières heures
  const lineupLower = new Date(now - LINEUP_WINDOW_MS).toISOString();
  const { data: lineupRows } = await supabase
    .from('match_lineups')
    .select('match_id')
    .eq('is_confirmed', true)
    .gte('created_at', lineupLower);
  const lineupMatchIds = Array.from(
    new Set((lineupRows ?? []).map((r) => r.match_id)),
  );
  for (const id of lineupMatchIds)
    events.push({ matchId: id, event: 'lineup_confirmed' });

  // Dispatch (notification_log dédoublonne donc on peut spammer sans risque)
  const results: DispatchResult[] = [];
  for (const { matchId, event } of events) {
    try {
      const r = await dispatchEvent(supabase, matchId, event);
      if (r.candidates > 0 || r.sent > 0) results.push(r);
    } catch (e) {
      console.error('[cron:dispatch] error', { matchId, event, e });
    }
  }

  const summary = {
    events_scanned: events.length,
    dispatches: results.length,
    total_sent: results.reduce((s, r) => s + r.sent, 0),
    total_skipped: results.reduce((s, r) => s + r.skipped_already_sent, 0),
    total_errors: results.reduce((s, r) => s + r.errors.length, 0),
    details: results,
  };

  console.log('[cron:dispatch-notifications]', summary);
  return NextResponse.json({ ok: summary.total_errors === 0, ...summary });
}
