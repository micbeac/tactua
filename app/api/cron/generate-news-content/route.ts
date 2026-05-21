// Cron de rattrapage : génère le contenu IA pour les news déjà scrapées
// qui n'ont pas encore de page interne (ai_content NULL).
//
// À déclencher manuellement après la migration, puis périodiquement si besoin.
// GET /api/cron/generate-news-content?limit=20
//   Authorization: Bearer ${CRON_SECRET}
//
// Coût : ~$0.0005/news × 20 = $0.01. Très safe.

import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import {
  buildNewsSlug,
  generateNewsContent,
  type NewsContext,
} from '@/lib/openai/news-content';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

type NewsRow = {
  id: number;
  title: string;
  snippet: string | null;
  url: string | null;
  team_id: number;
  teams: { name: string } | null;
};

async function getTeamContext(
  supabase: ReturnType<typeof createAdminClient>,
  teamId: number,
): Promise<{
  competition_name: string | null;
  league_position: number | null;
  recent_form: ('W' | 'D' | 'L')[] | null;
  next_match: NewsContext['next_match'];
}> {
  const [seasonRes, nextRes] = await Promise.all([
    supabase
      .from('team_season_stats')
      .select('position, form_last_5, competition:competitions(name)')
      .eq('team_id', teamId)
      .order('points', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('matches')
      .select(
        `id, kickoff_at, home_team_id, away_team_id,
         home_team:teams!matches_home_team_id_fkey(name),
         away_team:teams!matches_away_team_id_fkey(name)`,
      )
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq('status', 'scheduled')
      .gte('kickoff_at', new Date().toISOString())
      .order('kickoff_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  type SeasonRow = {
    position: number | null;
    form_last_5: string[] | null;
    competition: { name: string } | null;
  };
  type NextRow = {
    kickoff_at: string;
    home_team_id: number | null;
    away_team_id: number | null;
    home_team: { name: string } | null;
    away_team: { name: string } | null;
  };
  const season = seasonRes.data as unknown as SeasonRow | null;
  const next = nextRes.data as unknown as NextRow | null;
  let opponent: string | null = null;
  if (next) {
    opponent =
      next.home_team_id === teamId
        ? (next.away_team?.name ?? null)
        : (next.home_team?.name ?? null);
  }
  const form =
    (season?.form_last_5 ?? null)?.filter(
      (r): r is 'W' | 'D' | 'L' => r === 'W' || r === 'D' || r === 'L',
    ) ?? null;
  return {
    competition_name: season?.competition?.name ?? null,
    league_position: season?.position ?? null,
    recent_form: form,
    next_match:
      next && opponent ? { opponent, date_iso: next.kickoff_at } : null,
  };
}

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const limit = Math.min(50, Number(url.searchParams.get('limit') ?? '20'));

  const supabase = createAdminClient();
  const { data: news } = await supabase
    .from('team_narratives')
    .select(
      'id, title, snippet, url, team_id, teams!team_narratives_team_id_fkey(name)',
    )
    .is('ai_content', null)
    .order('scraped_at', { ascending: false })
    .limit(limit);

  const rows = (news ?? []) as unknown as NewsRow[];
  const stats = { ok: 0, errors: 0, total: rows.length };

  // Cache par team_id pour ne pas refaire 30 queries de contexte si même équipe
  const ctxCache = new Map<number, Awaited<ReturnType<typeof getTeamContext>>>();

  for (const row of rows) {
    if (!row.teams?.name) continue;
    try {
      let ctx = ctxCache.get(row.team_id);
      if (!ctx) {
        ctx = await getTeamContext(supabase, row.team_id);
        ctxCache.set(row.team_id, ctx);
      }
      const { content, model } = await generateNewsContent({
        title: row.title,
        snippet: row.snippet,
        source_url: row.url,
        team_name: row.teams.name,
        competition_name: ctx.competition_name,
        league_position: ctx.league_position,
        recent_form: ctx.recent_form,
        next_match: ctx.next_match,
      });
      const slug = buildNewsSlug(row.title, row.id);
      await supabase
        .from('team_narratives')
        .update({
          slug,
          ai_summary: content.summary.slice(0, 500),
          ai_content: content.content,
          ai_perspective: content.perspective,
          ai_generated_at: new Date().toISOString(),
          ai_model: model,
        })
        .eq('id', row.id);
      stats.ok += 1;
    } catch (e) {
      stats.errors += 1;
      console.error(
        `[generate-news-content] ${row.id}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  return NextResponse.json({ ok: stats.errors === 0, stats });
}
