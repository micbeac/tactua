// Cron quotidien : refresh des classements et de la forme récente.
// Schedule prod : tous les jours à 6h (vercel.json).

import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import { TRACKED_COMPETITIONS } from '@/lib/cron/competitions';
import { createFootballClient } from '@/lib/football-api/client';
import { mapStandingsToTeamSeasonStats } from '@/lib/football-api/mappers';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const football = createFootballClient();
  const supabase = createAdminClient();

  type CronError = { code: string; step: string; message: string };
  const stats = {
    rows_upserted: 0,
    competitions_processed: 0,
    errors: [] as CronError[],
  };

  for (const { code } of TRACKED_COMPETITIONS) {
    // Football-Data ne couvre pas la JPL (free tier) — l'import est manuel
    // via scripts/import-jupiler-pro-league.ts.
    if (code === 'BJL') continue;
    try {
      const standings = await football.getCompetitionStandings(code);
      const season = standings.season.startDate.slice(0, 4);
      const rows = mapStandingsToTeamSeasonStats(standings, season);

      if (rows.length) {
        const { error } = await supabase
          .from('team_season_stats')
          .upsert(rows, { onConflict: 'team_id,competition_id,season' });
        if (error)
          throw new Error(`team_season_stats upsert: ${error.message}`);
        stats.rows_upserted += rows.length;
      }
      stats.competitions_processed += 1;
    } catch (e) {
      // 404 attendu pour les compétitions sans table classique (ex : CDM en phase
      // de groupes pas encore commencée). On log mais on continue.
      stats.errors.push({
        code,
        step: 'refresh-rankings',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log('[cron:refresh-rankings]', stats);
  return NextResponse.json({ ok: stats.errors.length === 0, stats });
}
