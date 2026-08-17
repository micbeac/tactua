// Cron hebdo : refresh des données quasi-statiques.
// Pour chaque compétition trackée : metadata + équipes (+ joueurs des squads) + matches.
// Schedule prod : tous les lundis à 4h (vercel.json).
//
// ⚠️ Les 7 compétitions en série dépassent les 60 s de la limite Hobby : le
// run complet est coupé en cours de route et les dernières compétitions de
// TRACKED_COMPETITIONS ne sont jamais rafraîchies. D'où le paramètre `code`,
// qui permet de traiter une seule compétition par appel :
//   GET /api/cron/refresh-structures?code=PL
// Le run sans paramètre reste en place pour le cron hebdo, mais il faut le
// considérer comme « best effort » tant qu'on est sur Hobby.

import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import {
  TRACKED_COMPETITIONS,
  type TrackedCompetitionCode,
} from '@/lib/cron/competitions';
import { createFootballClient } from '@/lib/football-api/client';
import {
  mapCompetition,
  mapMatch,
  mapPlayer,
  mapTeam,
} from '@/lib/football-api/mappers';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const codeFilter = url.searchParams.get('code')?.toUpperCase() as
    | TrackedCompetitionCode
    | null
    | undefined;

  const football = createFootballClient();
  const supabase = createAdminClient();

  type CronError = { code: string; step: string; message: string };
  const stats = {
    competitions: 0,
    teams: 0,
    players: 0,
    matches: 0,
    errors: [] as CronError[],
  };

  const comps = codeFilter
    ? TRACKED_COMPETITIONS.filter((c) => c.code === codeFilter)
    : TRACKED_COMPETITIONS;

  if (codeFilter && comps.length === 0) {
    return NextResponse.json(
      {
        error: `Compétition inconnue : ${codeFilter}`,
        known: TRACKED_COMPETITIONS.map((c) => c.code),
      },
      { status: 400 },
    );
  }

  for (const { code } of comps) {
    // Football-Data ne couvre pas la JPL (free tier) — l'import est manuel
    // via scripts/import-jupiler-pro-league.ts.
    if (code === 'BJL') continue;
    try {
      const c = await football.getCompetition(code);
      const { error: cErr } = await supabase
        .from('competitions')
        .upsert(mapCompetition(c), { onConflict: 'id' });
      if (cErr) throw new Error(`competitions upsert: ${cErr.message}`);
      stats.competitions += 1;

      const teamsResp = await football.getCompetitionTeams(code);
      if (teamsResp.teams.length) {
        const { error: tErr } = await supabase
          .from('teams')
          .upsert(teamsResp.teams.map(mapTeam), { onConflict: 'id' });
        if (tErr) throw new Error(`teams upsert: ${tErr.message}`);
        stats.teams += teamsResp.teams.length;

        // Squads inline : on récupère les joueurs sans appel API supplémentaire.
        const players = teamsResp.teams.flatMap((t) =>
          (t.squad ?? []).map((p) => ({
            ...mapPlayer(p),
            current_team_id: p.currentTeam?.id ?? t.id,
          })),
        );
        if (players.length) {
          const { error: pErr } = await supabase
            .from('players')
            .upsert(players, { onConflict: 'id' });
          if (pErr) throw new Error(`players upsert: ${pErr.message}`);
          stats.players += players.length;
        }
      }

      const matchesResp = await football.getCompetitionMatches(code);
      if (matchesResp.matches.length) {
        const { error: mErr } = await supabase
          .from('matches')
          .upsert(matchesResp.matches.map(mapMatch), { onConflict: 'id' });
        if (mErr) throw new Error(`matches upsert: ${mErr.message}`);
        stats.matches += matchesResp.matches.length;
      }
    } catch (e) {
      stats.errors.push({
        code,
        step: 'refresh-structures',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log('[cron:refresh-structures]', stats);
  return NextResponse.json({ ok: stats.errors.length === 0, stats });
}
