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
import {
  buildNewsSlug,
  generateNewsContent,
  type NewsContext,
} from '@/lib/openai/news-content';
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
    ai_generated: 0,
    ai_failed: 0,
    skipped_recent: alreadyScrapedIds.size,
    errors: [] as CronError[],
  };

  // Récupère contexte équipe (compétition + forme + classement + prochain match)
  // pour l'IA. Une seule query par équipe → cache local.
  async function getTeamContext(teamId: number, teamName: string): Promise<{
    competition_name: string | null;
    league_position: number | null;
    next_match: NewsContext['next_match'];
  }> {
    const [seasonRes, nextRes] = await Promise.all([
      supabase
        .from('team_season_stats')
        .select('position, competition:competitions(name)')
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
    return {
      competition_name: season?.competition?.name ?? null,
      league_position: season?.position ?? null,
      next_match:
        next && opponent
          ? { opponent, date_iso: next.kickoff_at }
          : null,
    };
  }

  // Génère le contenu IA pour les news fraîchement insérées (par url).
  // Coût : ~$0.0005/news (gpt-4o-mini, ~500 tokens in, ~600 out).
  async function generateForTeam(team: TeamRow, urls: string[]) {
    if (urls.length === 0) return;
    // Recharge les rows insérées pour avoir leurs ids
    const { data: inserted } = await supabase
      .from('team_narratives')
      .select('id, title, snippet, url')
      .eq('team_id', team.id)
      .in('url', urls)
      .is('ai_content', null);
    if (!inserted || inserted.length === 0) return;

    const ctx = await getTeamContext(team.id, team.name);

    for (const row of inserted) {
      try {
        const { content, model } = await generateNewsContent({
          title: row.title,
          snippet: row.snippet,
          source_url: row.url,
          team_name: team.name,
          competition_name: ctx.competition_name,
          league_position: ctx.league_position,
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
        stats.ai_generated += 1;
      } catch (e) {
        stats.ai_failed += 1;
        stats.errors.push({
          team: `${team.name} (news ${row.id})`,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  // Concurrence à 1 : le plan Apify free a une limite de 8 GB de mémoire
  // cumulée. rag-web-browser alloue ~2-3 GB par run → 3 en parallèle dépasse.
  // À passer à 3-5 quand on upgrade en plan Personal ($49/mois).
  const CONCURRENCY = 1;
  async function processTeam(team: TeamRow) {
    try {
      const results = await ragWebSearch(buildQuery(team.name), 5);
      if (results.length === 0) return;

      const rows = results
        .filter((r) => r.metadata?.title && r.metadata?.url)
        .map((r) => ({
          team_id: team.id,
          title: r.metadata.title.slice(0, 300),
          url: r.metadata.url,
          snippet: extractSnippet(r),
          published_at: null,
          source: 'apify-rag',
        }));

      if (rows.length === 0) return;

      const { error } = await supabase
        .from('team_narratives')
        .upsert(rows, { onConflict: 'team_id,url_hash' });
      if (error) throw new Error(`upsert: ${error.message}`);
      stats.narratives_inserted += rows.length;
      stats.teams_processed += 1;

      // Génération IA des pages internes (non-bloquant si ça échoue)
      try {
        await generateForTeam(
          team,
          rows.map((r) => r.url).filter((u): u is string => Boolean(u)),
        );
      } catch (e) {
        console.error(
          `[cron:refresh-narratives] generateForTeam ${team.name}:`,
          e,
        );
      }
    } catch (e) {
      stats.errors.push({
        team: team.name,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const batch = list.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processTeam));
  }

  console.log('[cron:refresh-narratives]', stats);
  return NextResponse.json({ ok: stats.errors.length === 0, stats });
}
