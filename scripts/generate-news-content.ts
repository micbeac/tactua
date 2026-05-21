// Rattrapage local : génère le contenu IA pour toutes les news scrapées
// qui n'ont pas encore ai_content. Contourne le timeout 60s de Vercel Hobby.
//
// Usage : node --env-file=.env.local --experimental-strip-types scripts/generate-news-content.ts
//
// Variables d'env optionnelles :
//   NEWS_LIMIT=200          # nombre max traité par run (défaut 200)
//   NEWS_DELAY_MS=300       # délai entre news (défaut 300ms, OpenAI tolère)

import { createAdminClient } from '../lib/supabase/admin.ts';
import {
  buildNewsSlug,
  generateNewsContent,
  type NewsContext,
} from '../lib/openai/news-content.ts';

const LIMIT = Number(process.env.NEWS_LIMIT ?? 200);
const DELAY_MS = Number(process.env.NEWS_DELAY_MS ?? 300);
const MAX_RETRIES = 3;

const supabase = createAdminClient();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type NewsRow = {
  id: number;
  title: string;
  snippet: string | null;
  url: string | null;
  team_id: number;
  teams: { name: string } | null;
};

type TeamCtx = {
  competition_name: string | null;
  league_position: number | null;
  recent_form: ('W' | 'D' | 'L')[] | null;
  next_match: NewsContext['next_match'];
};

async function getTeamContext(teamId: number): Promise<TeamCtx> {
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
    next_match: next && opponent ? { opponent, date_iso: next.kickoff_at } : null,
  };
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isRate = /429|rate.?limit/i.test(msg);
      if (!isRate || attempt === MAX_RETRIES) throw e;
      const waitMs = 2000 * Math.pow(2, attempt);
      console.log(`    ⏳ rate-limit ${label}, retry dans ${waitMs}ms`);
      await sleep(waitMs);
    }
  }
  throw new Error('unreachable');
}

async function main() {
  console.log('▶ Sélection des news à enrichir...');
  const { data: news, error } = await supabase
    .from('team_narratives')
    .select(
      'id, title, snippet, url, team_id, teams!team_narratives_team_id_fkey(name)',
    )
    .is('ai_content', null)
    .order('scraped_at', { ascending: false })
    .limit(LIMIT);

  if (error) {
    console.error('❌ Supabase error:', error.message);
    process.exit(1);
  }

  const rows = (news ?? []) as unknown as NewsRow[];
  if (rows.length === 0) {
    console.log('✅ Aucune news à enrichir.');
    return;
  }

  console.log(`  ${rows.length} news à traiter (delay=${DELAY_MS}ms)\n`);

  let ok = 0;
  let errors = 0;
  const start = Date.now();
  const ctxCache = new Map<number, TeamCtx>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (!row.teams?.name) {
      errors++;
      continue;
    }
    try {
      let ctx = ctxCache.get(row.team_id);
      if (!ctx) {
        ctx = await getTeamContext(row.team_id);
        ctxCache.set(row.team_id, ctx);
      }
      const { content, model } = await withRetry(
        () =>
          generateNewsContent({
            title: row.title,
            snippet: row.snippet,
            source_url: row.url,
            team_name: row.teams!.name,
            competition_name: ctx!.competition_name,
            league_position: ctx!.league_position,
            recent_form: ctx!.recent_form,
            next_match: ctx!.next_match,
          }),
        `news ${row.id}`,
      );
      const slug = buildNewsSlug(row.title, row.id);
      const { error: updErr } = await supabase
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
      if (updErr) throw updErr;
      ok++;
      if (ok % 10 === 0) {
        const elapsed = Math.round((Date.now() - start) / 1000);
        const rate = (ok / elapsed).toFixed(2);
        console.log(`  ${ok}/${rows.length} OK (${rate} news/s, errors=${errors})`);
      }
    } catch (e) {
      errors++;
      console.error(
        `  ✗ ${row.title.slice(0, 50)} (id=${row.id}):`,
        e instanceof Error ? e.message : e,
      );
    }
    await sleep(DELAY_MS);
  }

  const elapsed = Math.round((Date.now() - start) / 1000);
  console.log(`\n✅ Terminé : ${ok} OK / ${errors} erreurs en ${elapsed}s`);

  const { count: remaining } = await supabase
    .from('team_narratives')
    .select('id', { count: 'exact', head: true })
    .is('ai_content', null);
  console.log(`  Reste à traiter : ${remaining ?? '?'} news.`);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
