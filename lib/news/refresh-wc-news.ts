// Rafraîchit le fil d'actualité dédié Coupe du Monde 2026 (table wc_news).
// Scrape deux types de contenu :
//   - news de sélection : une requête par équipe nationale engagée ;
//   - news transversales : sujets liés au tournoi (organisation, format…).
//
// Les articles sont insérés en 'draft'. L'admin les relit, les édite et les
// passe en 'published'. Partagé entre un éventuel déclencheur admin et le
// script local scripts/refresh-wc-news.ts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ragWebSearch, type RagBrowserResult } from '../apify/client.ts';
import { getWCNationalTeamIds } from '../data/world-cup.ts';
import { buildNewsSlug, generateNewsContent } from '../openai/news-content.ts';
import type { Database } from '../../types/database';

type Supa = SupabaseClient<Database>;

const SOURCES = [
  'lequipe.fr',
  'footmercato.net',
  'rmcsport.bfmtv.com',
  'maxifoot.fr',
  'eurosport.fr',
  'goal.com',
  'skysports.com',
];

function monthYear(): { month: string; year: number } {
  const now = new Date();
  return {
    month: new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
      timeZone: 'Europe/Paris',
    }).format(now),
    year: now.getFullYear(),
  };
}

function siteFilter(): string {
  return SOURCES.map((s) => `site:${s}`).join(' OR ');
}

function buildSelectionQuery(teamName: string): string {
  const { month, year } = monthYear();
  return `${teamName} sélection Coupe du Monde 2026 actualité ${month} ${year} liste OR blessure OR composition (${siteFilter()})`;
}

// Sujets transversaux au tournoi (pas rattachés à une sélection précise).
function buildTournamentQueries(): string[] {
  const { month, year } = monthYear();
  const f = siteFilter();
  return [
    `Coupe du Monde 2026 actualité ${month} ${year} (${f})`,
    `Coupe du Monde 2026 organisation préparation favoris (${f})`,
    `Coupe du Monde 2026 calendrier groupes sélections (${f})`,
  ];
}

function extractSnippet(r: RagBrowserResult): string {
  const desc = r.metadata?.description?.trim();
  if (desc && desc.length >= 60) return desc.slice(0, 280);
  const md = r.markdown ?? '';
  const paragraphs = md
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/[*_`>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((p) => p.length >= 80)
    .filter((p) => !/^(menu|connexion|s'inscrire|cookies?)$/i.test(p));
  return paragraphs[0]?.slice(0, 280) ?? '';
}

function domainOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export type RefreshWCNewsOptions = {
  /** Re-scrape même les URLs déjà vues. Défaut false. */
  force?: boolean;
  /** Nombre max de sélections traitées (défaut : toutes). */
  teamLimit?: number;
  /** Saute les requêtes transversales (news tournoi). */
  skipTournament?: boolean;
  /** Callback de progression. */
  onProgress?: (msg: string) => void;
};

export type RefreshWCNewsStats = {
  queries_run: number;
  articles_inserted: number;
  ai_generated: number;
  ai_failed: number;
  errors: Array<{ query: string; message: string }>;
};

export async function runRefreshWCNews(
  supabase: Supa,
  opts: RefreshWCNewsOptions = {},
): Promise<RefreshWCNewsStats> {
  const force = opts.force ?? false;
  const log = opts.onProgress ?? (() => {});

  const stats: RefreshWCNewsStats = {
    queries_run: 0,
    articles_inserted: 0,
    ai_generated: 0,
    ai_failed: 0,
    errors: [],
  };

  // URLs déjà en base (anti-doublon applicatif, en plus de la contrainte SQL).
  const knownUrls = new Set<string>();
  if (!force) {
    const { data } = await supabase
      .from('wc_news')
      .select('source_url')
      .limit(10000);
    for (const r of (data ?? []) as { source_url: string | null }[]) {
      if (r.source_url) knownUrls.add(r.source_url);
    }
  }

  // Liste des sélections (id + nom).
  const nationalIds = await getWCNationalTeamIds(supabase);
  let teams: Array<{ id: number; name: string }> = [];
  if (nationalIds.length > 0) {
    const { data } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', nationalIds);
    teams = (data ?? []) as Array<{ id: number; name: string }>;
  }
  if (opts.teamLimit != null) teams = teams.slice(0, opts.teamLimit);

  // Traite une requête : scrape, insère les drafts, génère l'IA.
  async function processQuery(args: {
    query: string;
    category: 'selection' | 'tournoi';
    teamId: number | null;
    teamName: string;
  }) {
    const { query, category, teamId, teamName } = args;
    try {
      stats.queries_run += 1;
      const results = await ragWebSearch(query, 5);
      const fresh = results.filter(
        (r) =>
          r.metadata?.title &&
          r.metadata?.url &&
          (force || !knownUrls.has(r.metadata.url)),
      );
      if (fresh.length === 0) {
        log(`  · ${teamName} : rien de neuf`);
        return;
      }

      const rows = fresh.map((r) => ({
        team_id: teamId,
        category,
        title: r.metadata.title.slice(0, 300),
        source_url: r.metadata.url,
        source_name: domainOf(r.metadata.url),
        snippet: extractSnippet(r),
        status: 'draft' as const,
      }));

      const { data: inserted, error } = await supabase
        .from('wc_news')
        .upsert(rows, { onConflict: 'url_hash', ignoreDuplicates: true })
        .select('id, title, snippet, source_url');
      if (error) throw new Error(`upsert: ${error.message}`);

      const newRows = (inserted ?? []) as Array<{
        id: number;
        title: string;
        snippet: string | null;
        source_url: string | null;
      }>;
      stats.articles_inserted += newRows.length;
      for (const r of newRows) {
        if (r.source_url) knownUrls.add(r.source_url);
      }
      log(`  ✅ ${teamName} : ${newRows.length} articles`);

      // Génération IA (rédaction + résumé) pour chaque nouvel article.
      for (const row of newRows) {
        try {
          const { content, model } = await generateNewsContent({
            title: row.title,
            snippet: row.snippet,
            source_url: row.source_url,
            team_name:
              category === 'tournoi' ? 'la Coupe du Monde 2026' : teamName,
            competition_name: 'Coupe du Monde 2026',
          });
          await supabase
            .from('wc_news')
            .update({
              slug: buildNewsSlug(row.title, row.id),
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
            query: `IA news ${row.id}`,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    } catch (e) {
      stats.errors.push({
        query,
        message: e instanceof Error ? e.message : String(e),
      });
      log(`  ✗ ${teamName} : ${e instanceof Error ? e.message : e}`);
    }
  }

  // 1. News transversales au tournoi.
  if (!opts.skipTournament) {
    for (const q of buildTournamentQueries()) {
      log(`▶ Tournoi : ${q.slice(0, 60)}…`);
      await processQuery({
        query: q,
        category: 'tournoi',
        teamId: null,
        teamName: 'Coupe du Monde',
      });
    }
  }

  // 2. News par sélection.
  for (const team of teams) {
    log(`▶ ${team.name}`);
    await processQuery({
      query: buildSelectionQuery(team.name),
      category: 'selection',
      teamId: team.id,
      teamName: team.name,
    });
  }

  return stats;
}
