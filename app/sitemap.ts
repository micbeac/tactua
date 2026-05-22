import type { MetadataRoute } from 'next';
import { SITE_URL as BASE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import { playerHref, teamHref } from '@/lib/url';

// Cap par section pour rester sous la limite de 50k URLs sitemap.
const MAX_TEAMS = 500;
const MAX_PLAYERS = 5000;
const MAX_MATCHES = 5000;
const MAX_NEWS = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [teamsRes, playersRes, matchesRes, newsRes] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, last_updated_at')
      .order('id')
      .limit(MAX_TEAMS),
    supabase
      .from('players')
      .select('id, name, last_updated_at')
      .order('id')
      .limit(MAX_PLAYERS),
    supabase
      .from('matches')
      .select('id, kickoff_at, last_updated_at')
      .order('kickoff_at', { ascending: false })
      .limit(MAX_MATCHES),
    supabase
      .from('team_narratives')
      .select('slug, ai_generated_at, scraped_at, team_id')
      .not('ai_content', 'is', null)
      .not('slug', 'is', null)
      .order('scraped_at', { ascending: false })
      .limit(MAX_NEWS),
  ]);

  const teams = teamsRes.data ?? [];
  const players = playersRes.data ?? [];
  const matches = matchesRes.data ?? [];
  const news = newsRes.data ?? [];

  const now = new Date();

  // Uniquement des pages publiques indexables — surtout PAS /login ni
  // /signup (interdites dans robots.txt : un sitemap ne doit jamais lister
  // de pages bloquées, c'est un signal contradictoire pour Google).
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/coupe-du-monde-2026`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/news`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.6,
    },
  ];

  const teamEntries: MetadataRoute.Sitemap = teams.map((t) => ({
    url: `${BASE_URL}${teamHref(t.id, t.name)}`,
    lastModified: t.last_updated_at ? new Date(t.last_updated_at) : now,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  const playerEntries: MetadataRoute.Sitemap = players.map((p) => ({
    url: `${BASE_URL}${playerHref(p.id, p.name)}`,
    lastModified: p.last_updated_at ? new Date(p.last_updated_at) : now,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  const matchEntries: MetadataRoute.Sitemap = matches.map((m) => ({
    url: `${BASE_URL}/matches/${m.id}`,
    lastModified: m.last_updated_at ? new Date(m.last_updated_at) : now,
    changeFrequency: 'hourly',
    priority: 0.8,
  }));

  const newsEntries: MetadataRoute.Sitemap = (
    news as Array<{
      slug: string | null;
      ai_generated_at: string | null;
      scraped_at: string;
    }>
  )
    .filter((n) => n.slug)
    .map((n) => ({
      url: `${BASE_URL}/news/${n.slug}`,
      lastModified: n.ai_generated_at
        ? new Date(n.ai_generated_at)
        : new Date(n.scraped_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

  return [
    ...staticEntries,
    ...matchEntries,
    ...teamEntries,
    ...playerEntries,
    ...newsEntries,
  ];
}
