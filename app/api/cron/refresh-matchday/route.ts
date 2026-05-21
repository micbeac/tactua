// Cron haute fréquence : refresh des matchs imminents (status + scores depuis
// Football-Data) + enrichissement (lineups + stats équipes + stats joueurs)
// depuis API-Football si dispo dans la fenêtre.
//
// Fenêtre : matchs avec kickoff dans [now - 2h, now + 24h] et pas encore finished.
//
// Schedule prod : ce cron est ÉCRIT pour tourner toutes les 2-3 min mais Vercel
// Hobby ne permet pas cette fréquence. En attendant Pro, le cron n'est pas dans
// vercel.json — à invoquer manuellement ou activer après upgrade Pro.
//
// Garde-fou quota API-Football (100 req/jour, 4 req par enrich) :
//   MAX_ENRICH_PER_RUN limite à 5 matchs par exécution = 20 req max.
//   On enrich uniquement les matchs qui n'ont pas encore lineups OU pas encore
//   team_stats en base — pour éviter de gaspiller le quota.

import { NextResponse } from 'next/server';
import { enrichMatchFromApiFootball } from '@/lib/api-football/enrich';
import { requireCronAuth } from '@/lib/cron/auth';
import { createFootballClient } from '@/lib/football-api/client';
import { mapMatch } from '@/lib/football-api/mappers';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const PRE_KICKOFF_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h avant
const POST_KICKOFF_WINDOW_MS = 3 * 60 * 60 * 1000; // 3h après (couvre les prolongations CDM)
const MAX_ENRICH_PER_RUN = 10;

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
    .order('kickoff_at', { ascending: true });

  // Tri : on traite les matchs live EN PREMIER, puis les imminents, puis les autres.
  // Sécurise le quota : si on a 10 matchs live + 5 imminents, les lives sont prioritaires.
  if (pending) {
    pending.sort((a, b) => {
      const aLive = a.status === 'live' ? 0 : 1;
      const bLive = b.status === 'live' ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime();
    });
  }

  if (queryErr) {
    console.error('[cron:refresh-matchday] query error', queryErr);
    return NextResponse.json(
      { ok: false, error: queryErr.message },
      { status: 500 },
    );
  }

  type CronError = { match_id: number; step: string; message: string };
  const stats = {
    candidates: pending?.length ?? 0,
    refreshed: 0,
    enriched: 0,
    enriched_live: 0,
    enrich_skipped_already: 0,
    enrich_skipped_quota: 0,
    errors: [] as CronError[],
  };

  // ============================================================================
  // 1. Refresh Football-Data (status + score)
  // ============================================================================
  for (const m of pending ?? []) {
    if (m.status === 'finished') continue; // déjà finis : pas besoin de refresh status
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
        step: 'refresh',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // ============================================================================
  // 2. Enrichissement API-Football (lineups + stats) sur matchs dans la fenêtre
  // ============================================================================
  if (!process.env.API_FOOTBALL_KEY) {
    console.log(
      '[cron:refresh-matchday] API_FOOTBALL_KEY absent, enrichissement skippé',
    );
    return NextResponse.json({ ok: stats.errors.length === 0, stats });
  }

  // On cherche les matchs qui n'ont PAS encore de team_stats (= pas encore enrichis)
  // ET dans la fenêtre. Priorité aux matchs récents/imminents.
  const candidateIds = (pending ?? []).map((m) => m.id);
  if (candidateIds.length === 0) {
    return NextResponse.json({ ok: stats.errors.length === 0, stats });
  }

  const { data: alreadyStats } = await supabase
    .from('match_team_stats')
    .select('match_id')
    .in('match_id', candidateIds);
  const alreadyStatsSet = new Set((alreadyStats ?? []).map((r) => r.match_id));

  let enrichBudget = MAX_ENRICH_PER_RUN;
  for (const m of pending ?? []) {
    if (enrichBudget <= 0) {
      stats.enrich_skipped_quota += 1;
      continue;
    }
    // Re-enrich systématique pour les matchs LIVE (events / stats évoluent
    // toutes les minutes). Pour les pré-match, skip si déjà fait.
    const isLive = m.status === 'live';
    if (alreadyStatsSet.has(m.id) && !isLive) {
      stats.enrich_skipped_already += 1;
      continue;
    }

    try {
      const r = await enrichMatchFromApiFootball(supabase, m.id);
      if (r.fixture_id) {
        if (isLive) stats.enriched_live += 1;
        else stats.enriched += 1;
        enrichBudget -= 1;
      }
    } catch (e) {
      stats.errors.push({
        match_id: m.id,
        step: 'enrich',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log('[cron:refresh-matchday]', stats);
  return NextResponse.json({ ok: stats.errors.length === 0, stats });
}
