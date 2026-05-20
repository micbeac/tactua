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
  // On cible les articles individuels (URLs avec /article ou /football/),
  // pas les pages catégorie. Le mois et l'année actuels forcent Google à
  // prioriser les résultats récents.
  const now = new Date();
  const monthFr = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(
    now,
  );
  const year = now.getFullYear();
  const sources = SOURCES.map((s) => `site:${s}`).join(' OR ');
  return `${teamName} actualité ${monthFr} ${year} transfert OR blessure OR composition (${sources})`;
}

function extractSnippet(r: RagBrowserResult): string {
  // Stratégie en cascade :
  // 1. Si metadata.description existe, l'utiliser (= description SEO, souvent
  //    le meilleur résumé d'un article)
  // 2. Sinon, parser le markdown et extraire le 1er paragraphe substantiel
  //    (≥ 80 caractères, en sautant la nav/header)
  const desc = r.metadata?.description?.trim();
  if (desc && desc.length >= 60) return desc.slice(0, 280);

  const md = r.markdown ?? '';
  // Découpe par paragraphes et filtre ceux qui ressemblent à du contenu
  const paragraphs = md
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .replace(/^#{1,6}\s+/gm, '') // retire les marqueurs de titre
        .replace(/!\[.*?\]\(.*?\)/g, '') // retire les images
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // déstructure les liens
        .replace(/[*_`>|]/g, '') // retire formatage markdown
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((p) => p.length >= 80) // ignore les petits trucs (nav, dates seules)
    .filter((p) => !/^(menu|connexion|s'inscrire|cookies?)$/i.test(p));

  return paragraphs[0]?.slice(0, 280) ?? '';
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
  const limit = Number(url.searchParams.get('limit') ?? '15');
  // Permet de cibler 1 équipe spécifique
  const teamIdFilter = url.searchParams.get('team_id')
    ? Number(url.searchParams.get('team_id'))
    : null;
  // Force le re-scraping même pour les équipes déjà fraîchement scrapées
  const force = url.searchParams.get('force') === '1';
  // Démarre après ce team_id (pagination simple)
  const afterTeamId = Number(url.searchParams.get('after') ?? '0');

  const supabase = createAdminClient();

  // Pré-filtre : on récupère les team_ids ayant été scrapés dans les 7 derniers
  // jours pour les exclure (sauf si force=1).
  let alreadyScrapedIds = new Set<number>();
  if (!force && !teamIdFilter) {
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: recent } = await supabase
      .from('team_narratives')
      .select('team_id')
      .gte('scraped_at', sevenDaysAgo);
    alreadyScrapedIds = new Set((recent ?? []).map((r) => r.team_id));
  }

  // Équipes ciblées : celles avec api_football_id (= équipes des compétitions
  // trackées), pour ne pas gaspiller le quota sur des équipes non utilisées.
  let query = supabase
    .from('teams')
    .select('id, name')
    .not('api_football_id', 'is', null)
    .gt('id', afterTeamId)
    .order('id', { ascending: true });
  if (teamIdFilter) query = query.eq('id', teamIdFilter);
  query = query.limit(limit * 3); // on récupère plus, on filtrera ensuite

  const { data: allTeams } = await query;
  const teams = (allTeams ?? [])
    .filter((t) => !alreadyScrapedIds.has(t.id))
    .slice(0, limit);

  type TeamRow = { id: number; name: string };
  const list = teams as TeamRow[];

  type CronError = { team: string; message: string };
  const stats = {
    teams_processed: 0,
    narratives_inserted: 0,
    skipped_recent: alreadyScrapedIds.size,
    errors: [] as CronError[],
  };

  for (const team of list) {
    try {
      const results = await ragWebSearch(buildQuery(team.name), 5);
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
