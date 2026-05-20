// Cron hebdo : récupère 3 articles d'actu par équipe trackée via Apify.
// Stocké dans team_narratives → utilisé dans le prompt IA + fiche équipe.
//
// Auth : header `Authorization: Bearer ${CRON_SECRET}`.
// Pas dans vercel.json (limite 2 cron sur Hobby) : à lancer manuellement
// 1× par semaine. ~5 minutes par run pour 100 équipes (Apify rate limit).
//
// Quota Apify : ~$0.05 par recherche rag-web-browser. 100 équipes × 1 req
// hebdo = ~5$ / mois (couvert par le free tier $5/mois).

import { NextResponse } from 'next/server';
import { ragWebSearch, type RagBrowserResult } from '@/lib/apify/client';
import { requireCronAuth } from '@/lib/cron/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min : on traite max ~50 équipes par run
export const dynamic = 'force-dynamic';

// Pour éviter de scraper des contenus parasites (forums, wiki, fan sites),
// on cible explicitement les principaux médias foot francophones et anglophones.
const SOURCES = [
  'lequipe.fr',
  'footmercato.net',
  'rmcsport.bfmtv.com',
  'maxifoot.fr',
  'eurosport.fr',
  'goal.com',
  'skysports.com',
];

function buildQuery(teamName: string): string {
  const sources = SOURCES.map((s) => `site:${s}`).join(' OR ');
  return `${teamName} dernières actualités (${sources})`;
}

function extractSnippet(r: RagBrowserResult): string {
  // Récupère les ~250 premiers caractères significatifs du markdown
  const md = r.markdown ?? '';
  const cleaned = md
    .replace(/^#.*$/gm, '') // retire les titres markdown
    .replace(/!\[.*?\]\(.*?\)/g, '') // retire les images
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // déstructure les liens
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 280);
}

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
  // Permet de limiter le run à N équipes (utile pour tester sans burn le quota)
  const limit = Number(url.searchParams.get('limit') ?? '50');
  // Permet de cibler 1 équipe spécifique
  const teamIdFilter = url.searchParams.get('team_id')
    ? Number(url.searchParams.get('team_id'))
    : null;

  const supabase = createAdminClient();

  // Équipes ciblées : celles avec api_football_id (= équipes des compétitions
  // trackées), pour ne pas gaspiller le quota sur des équipes non utilisées.
  let query = supabase
    .from('teams')
    .select('id, name')
    .not('api_football_id', 'is', null)
    .order('id', { ascending: true });
  if (teamIdFilter) query = query.eq('id', teamIdFilter);
  query = query.limit(limit);

  const { data: teams } = await query;

  type TeamRow = { id: number; name: string };
  const list = (teams ?? []) as TeamRow[];

  type CronError = { team: string; message: string };
  const stats = {
    teams_processed: 0,
    narratives_inserted: 0,
    errors: [] as CronError[],
  };

  for (const team of list) {
    try {
      const results = await ragWebSearch(buildQuery(team.name), 3);
      if (results.length === 0) continue;

      const rows = results
        .filter((r) => r.metadata?.title && r.metadata?.url)
        .map((r) => ({
          team_id: team.id,
          title: r.metadata.title.slice(0, 300),
          url: r.metadata.url,
          snippet: extractSnippet(r),
          published_at: null, // pas exposé par rag-web-browser
          source: 'apify-rag',
        }));

      if (rows.length === 0) continue;

      const { error } = await supabase
        .from('team_narratives')
        .upsert(rows, { onConflict: 'team_id,url_hash' });
      if (error) throw new Error(`upsert: ${error.message}`);
      stats.narratives_inserted += rows.length;
      stats.teams_processed += 1;
    } catch (e) {
      stats.errors.push({
        team: team.name,
        message: e instanceof Error ? e.message : String(e),
      });
    }
    // Petit délai pour éviter de saturer Apify (très conservatif)
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log('[cron:refresh-narratives]', stats);
  return NextResponse.json({ ok: stats.errors.length === 0, stats });
}
