// Cron : récupère des articles d'actu par équipe via Apify + génère leurs
// pages internes. La logique est dans lib/news/refresh-narratives.ts
// (partagée avec scripts/refresh-narratives.ts).
//
// ⚠ Le scraping Apify est lent (~15-30 s/équipe). Sur Vercel Hobby
// (fonctions ≤ 60 s) seul un mini-batch passe — utilise un `limit` bas.
// Pour rafraîchir TOUTES les équipes, lance plutôt le script local
// `node --env-file=.env.local scripts/refresh-narratives.ts` (sans timeout).
//
// Auth : header `Authorization: Bearer ${CRON_SECRET}`.

import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import { runRefreshNarratives } from '@/lib/news/refresh-narratives';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json(
      { ok: false, error: 'APIFY_TOKEN manquant en environnement' },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') ?? '15');
  const teamIdFilter = url.searchParams.get('team_id')
    ? Number(url.searchParams.get('team_id'))
    : null;
  const force = url.searchParams.get('force') === '1';
  const afterTeamId = Number(url.searchParams.get('after') ?? '0');

  const supabase = createAdminClient();
  const stats = await runRefreshNarratives(supabase, {
    limit,
    teamIdFilter,
    force,
    afterTeamId,
  });

  console.log('[cron:refresh-narratives]', stats);
  return NextResponse.json({ ok: stats.errors.length === 0, stats });
}
