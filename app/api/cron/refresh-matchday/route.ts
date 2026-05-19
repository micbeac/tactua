// Cron haute fréquence : refresh des matchs imminents (lineups officielles + scores).
// Fenêtre : matchs avec kickoff dans [now - 2h, now + 24h] et pas encore finished.
//
// Schedule prod : ce cron est ÉCRIT pour tourner toutes les 2-3 min mais Vercel
// Hobby ne permet pas cette fréquence. En attendant Pro, vercel.json le déclare
// à */10 (toutes les 10 min) — frontière de tolérance habituelle.
//
// Note : pour Jour 5 on ne refresh que la table `matches` (status + score).
// Les lineups détaillées arrivent Jour 8 quand on les affichera côté UI.

import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import { createFootballClient } from '@/lib/football-api/client';
import { mapMatch } from '@/lib/football-api/mappers';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const PRE_KICKOFF_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h avant
const POST_KICKOFF_WINDOW_MS = 2 * 60 * 60 * 1000; // 2h après

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const football = createFootballClient();
  const supabase = createAdminClient();

  const now = Date.now();
  const lowerBound = new Date(now - POST_KICKOFF_WINDOW_MS).toISOString();
  const upperBound = new Date(now + PRE_KICKOFF_WINDOW_MS).toISOString();

  const { data: pending, error: queryErr } = await supabase
    .from('matches')
    .select('id, status, kickoff_at')
    .gte('kickoff_at', lowerBound)
    .lte('kickoff_at', upperBound)
    .neq('status', 'finished')
    .order('kickoff_at', { ascending: true });

  if (queryErr) {
    console.error('[cron:refresh-matchday] query error', queryErr);
    return NextResponse.json(
      { ok: false, error: queryErr.message },
      { status: 500 },
    );
  }

  type CronError = { match_id: number; message: string };
  const stats = {
    candidates: pending?.length ?? 0,
    refreshed: 0,
    errors: [] as CronError[],
  };

  for (const m of pending ?? []) {
    try {
      const detail = await football.getMatch(m.id);
      const { error } = await supabase
        .from('matches')
        .upsert(mapMatch(detail), { onConflict: 'id' });
      if (error) throw new Error(`matches upsert: ${error.message}`);
      stats.refreshed += 1;
    } catch (e) {
      stats.errors.push({
        match_id: m.id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log('[cron:refresh-matchday]', stats);
  return NextResponse.json({ ok: stats.errors.length === 0, stats });
}
