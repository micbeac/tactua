// Cron : import de la Jupiler Pro League depuis API-Football.
//
// Football-Data ne couvre pas la JPL, elle est donc exclue de
// refresh-structures et refresh-rankings. Elle dépendait jusqu'ici d'un
// script lancé à la main, avec la saison écrite en dur — résultat : la
// compétition est restée figée sur 2025-26 (dernier match affiché : 24 mai)
// alors que le championnat belge avait repris fin juillet.
//
// Deux modes, parce que les fonctions Hobby sont coupées à 60 s :
//   GET /api/cron/refresh-jupiler              → équipes + calendrier + classement (3 appels)
//   GET /api/cron/refresh-jupiler?part=squads  → effectifs (1 appel par club)
//
// Auth : header `Authorization: Bearer ${CRON_SECRET}`, envoyé
// automatiquement par Vercel Cron.

import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import { importJplCore, importJplSquads } from '@/lib/api-football/jupiler';
import { currentSeason } from '@/lib/season';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SQUADS_BUDGET_MS = 45_000;

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const part = url.searchParams.get('part');
  // `season` reste surchargeable pour rejouer un import passé, mais la valeur
  // par défaut est calculée : c'est une constante en dur qui avait figé la
  // compétition sur la saison précédente.
  const seasonParam = url.searchParams.get('season');
  const season = seasonParam ? Number(seasonParam) : currentSeason();

  if (!Number.isFinite(season)) {
    return NextResponse.json(
      { error: `season invalide : ${seasonParam}` },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  try {
    if (part === 'squads') {
      const stats = await importJplSquads(supabase, SQUADS_BUDGET_MS);
      console.log('[cron:refresh-jupiler][squads]', stats);
      return NextResponse.json({ ok: stats.errors.length === 0, stats });
    }

    const stats = await importJplCore(supabase, season);
    console.log('[cron:refresh-jupiler][core]', stats);
    return NextResponse.json({ ok: stats.errors.length === 0, stats });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[cron:refresh-jupiler] échec', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
