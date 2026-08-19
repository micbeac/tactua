// Cron : résout teams.api_football_id pour les équipes qui n'en ont pas.
//
// Sans ce mapping, tout l'enrichissement API-Football tombe : compositions,
// notes de joueurs, stats détaillées, xG — et surtout la voie « deep » de
// l'analyse IA, qui exige l'id AF des deux équipes et retombe sinon en
// silence sur un prompt basique.
//
// Le mapping n'existait que sous forme de script manuel lancé en mai : les
// équipes arrivées avec la saison 2026-27 n'étaient pas mappées.
//
//   GET /api/cron/map-teams            → toutes les compétitions
//   GET /api/cron/map-teams?code=PL    → une seule
//
// Auth : header `Authorization: Bearer ${CRON_SECRET}`.

import { NextResponse } from 'next/server';
import { mapTeamsForCompetition } from '@/lib/api-football/team-mapping';
import { requireCronAuth } from '@/lib/cron/auth';
import {
  TRACKED_COMPETITIONS,
  type TrackedCompetitionCode,
} from '@/lib/cron/competitions';
import { currentSeason } from '@/lib/season';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Une compétition sans équipe à mapper ne coûte aucun appel API, mais celles
// qui en ont enchaînent un appel + N écritures : on garde de la marge sous
// les 60 s de Vercel Hobby.
const TIME_BUDGET_MS = 45_000;

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const codeFilter = url.searchParams.get('code')?.toUpperCase() as
    | TrackedCompetitionCode
    | null
    | undefined;
  const seasonParam = url.searchParams.get('season');
  const season = seasonParam ? Number(seasonParam) : currentSeason();

  const comps = codeFilter
    ? TRACKED_COMPETITIONS.filter((c) => c.code === codeFilter)
    : TRACKED_COMPETITIONS;

  if (comps.length === 0) {
    return NextResponse.json(
      {
        error: `Compétition inconnue : ${codeFilter}`,
        known: TRACKED_COMPETITIONS.map((c) => c.code),
      },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const startedAt = Date.now();
  const results = [];
  const skipped: string[] = [];
  const errors: Array<{ code: string; message: string }> = [];

  for (const c of comps) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      skipped.push(c.code);
      continue;
    }
    try {
      const stats = await mapTeamsForCompetition(
        supabase,
        c.fd_id,
        c.af_league_id,
        season,
        c.label,
      );
      results.push(stats);
    } catch (e) {
      errors.push({
        code: c.code,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const totalMapped = results.reduce((s, r) => s + r.newly_mapped, 0);
  const payload = { season, total_newly_mapped: totalMapped, results, skipped, errors };
  console.log('[cron:map-teams]', JSON.stringify(payload));
  return NextResponse.json({ ok: errors.length === 0, ...payload });
}
