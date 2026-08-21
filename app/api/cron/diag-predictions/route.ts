// ⚠️ ROUTE TEMPORAIRE DE DIAGNOSTIC — à supprimer une fois l'audit terminé.
//
// Objectif : constater ce que /predictions renvoie réellement. Notre type
// PredictionResponse ne déclare que le bloc `comparison`, et on soupçonne
// l'endpoint de contenir bien plus (probabilités propres du modèle, conseil,
// stats des deux équipes, et peut-être le H2H qu'on repaie via un second
// appel à /fixtures/headtohead).
//
// On logge la STRUCTURE (clés, types, échantillon de valeur tronqué), pas la
// réponse entière : un dump brut serait illisible dans les logs Vercel.
//
//   GET /api/cron/diag-predictions              → 1er match à venir avec fixture AF
//   GET /api/cron/diag-predictions?fixture=123  → fixture imposée

import { NextResponse } from 'next/server';
import { af } from '@/lib/api-football/deep-stats';
import { requireCronAuth } from '@/lib/cron/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Décrit récursivement la forme d'une valeur, sans en dérouler le contenu. */
function describe(value: unknown, depth = 0): unknown {
  if (depth > 4) return '…';
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return value.length === 0
      ? 'array(vide)'
      : { __array_length: value.length, __premier: describe(value[0], depth + 1) };
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = describe(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string') {
    return value.length > 40 ? `string("${value.slice(0, 40)}…")` : `string("${value}")`;
  }
  return `${typeof value}(${String(value)})`;
}

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  let fixtureId = Number(url.searchParams.get('fixture')) || null;

  if (!fixtureId) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('matches')
      .select('id, api_football_fixture_id, kickoff_at')
      .not('api_football_fixture_id', 'is', null)
      .gte('kickoff_at', new Date().toISOString())
      .order('kickoff_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    fixtureId = (data as { api_football_fixture_id: number } | null)
      ?.api_football_fixture_id ?? null;
  }

  if (!fixtureId) {
    return NextResponse.json(
      { error: 'Aucun match à venir avec un api_football_fixture_id' },
      { status: 404 },
    );
  }

  const raw = await af<{ response: unknown[] }>(
    `/predictions?fixture=${fixtureId}`,
  );
  const first = raw.response?.[0];

  const shape = describe(first);
  console.log(
    `[diag:predictions] fixture=${fixtureId} shape=${JSON.stringify(shape)}`,
  );

  return NextResponse.json({ fixture_id: fixtureId, shape });
}
