// Logique de rafraîchissement des actus équipe (scraping Apify + génération
// IA des pages internes). Partagée entre le cron route et le script local.
//
// Pourquoi une lib partagée : le scraping Apify est lent (~15-30 s par
// équipe). Sur Vercel Hobby (fonctions plafonnées à 60 s) seul un petit
// batch passe ; le script local, lui, n'a aucun timeout et traite tout.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ragWebSearch, type RagBrowserResult } from '@/lib/apify/client';
import {
  buildNewsSlug,
  generateNewsContent,
  type NewsContext,
} from '@/lib/openai/news-content';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

// Médias foot ciblés (évite forums / wikis / fan sites parasites).
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
  const now = new Date();
  const monthFr = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    timeZone: 'Europe/Paris',
  }).format(now);
  const year = now.getFullYear();
  const sources = SOURCES.map((s) => `site:${s}`).join(' OR ');
  return `${teamName} actualité ${monthFr} ${year} transfert OR blessure OR composition (${sources})`;
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

export type RefreshNarrativesOptions = {
  /** Nombre d'équipes traitées par run. Défaut 15. */
  limit?: number;
  /** Re-scrape même les équipes fraîchement scrapées (< 7 j). */
  force?: boolean;
  /** Cible une seule équipe. */
  teamIdFilter?: number | null;
  /** Reprend après ce team_id (pagination). */
  afterTeamId?: number;
  /** Callback de progression (pour les logs du script). */
  onProgress?: (msg: string) => void;
};

export type RefreshNarrativesStats = {
  teams_processed: number;
  narratives_inserted: number;
  ai_generated: number;
  ai_failed: number;
  skipped_recent: number;
  errors: Array<{ team: string; message: string }>;
};

export async function runRefreshNarratives(
  supabase: Supa,
  opts: RefreshNarrativesOptions = {},
): Promise<RefreshNarrativesStats> {
  const limit = opts.limit ?? 15;
  const force = opts.force ?? false;
  const teamIdFilter = opts.teamIdFilter ?? null;
  const afterTeamId = opts.afterTeamId ?? 0;
  const log = opts.onProgress ?? (() => {});

  // Exclut les équipes scrapées dans les 7 derniers jours (sauf force).
  let alreadyScrapedIds = new Set<number>();
  if (!force && !teamIdFilter) {
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: recent } = await supabase
      .from('team_narratives')
      .select('team_id')
      .gte('scraped_at', sevenDaysAgo);
    alreadyScrapedIds = new Set(
      (recent ?? []).map((r) => (r as { team_id: number }).team_id),
    );
  }

  let query = supabase
    .from('teams')
    .select('id, name')
    .not('api_football_id', 'is', null)
    .gt('id', afterTeamId)
    .order('id', { ascending: true });
  if (teamIdFilter) query = query.eq('id', teamIdFilter);
  query = query.limit(limit * 3);

  const { data: allTeams } = await query;
  type TeamRow = { id: number; name: string };
  const list = ((allTeams ?? []) as TeamRow[])
    .filter((t) => !alreadyScrapedIds.has(t.id))
    .slice(0, limit);

  const stats: RefreshNarrativesStats = {
    teams_processed: 0,
    narratives_inserted: 0,
    ai_generated: 0,
    ai_failed: 0,
    skipped_recent: alreadyScrapedIds.size,
    errors: [],
  };

  async function getTeamContext(teamId: number): Promise<{
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
        next && opponent ? { opponent, date_iso: next.kickoff_at } : null,
    };
  }

  async function generateForTeam(team: TeamRow, urls: string[]) {
    if (urls.length === 0) return;
    const { data: inserted } = await supabase
      .from('team_narratives')
      .select('id, title, snippet, url')
      .eq('team_id', team.id)
      .in('url', urls)
      .is('ai_content', null);
    if (!inserted || inserted.length === 0) return;

    const ctx = await getTeamContext(team.id);

    for (const row of inserted as Array<{
      id: number;
      title: string;
      snippet: string | null;
      url: string | null;
    }>) {
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

  async function processTeam(team: TeamRow) {
    try {
      log(`▶ ${team.name}`);
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

      try {
        await generateForTeam(
          team,
          rows.map((r) => r.url).filter((u): u is string => Boolean(u)),
        );
      } catch (e) {
        console.error(`[refresh-narratives] generateForTeam ${team.name}:`, e);
      }
      log(`  ✅ ${team.name} : ${rows.length} articles`);
    } catch (e) {
      stats.errors.push({
        team: team.name,
        message: e instanceof Error ? e.message : String(e),
      });
      log(`  ✗ ${team.name} : ${e instanceof Error ? e.message : e}`);
    }
  }

  // Concurrence 1 : rag-web-browser alloue ~2-3 GB par run (limite Apify free 8 GB).
  for (const team of list) {
    await processTeam(team);
  }

  return stats;
}
