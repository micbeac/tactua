import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';
import { playerHref, teamHref } from '@/lib/url';

const BASE_URL = 'https://tactua.vercel.app';

// Cap par section pour rester sous la limite de 50k URLs sitemap.
const MAX_TEAMS = 500;
const MAX_PLAYERS = 5000;
const MAX_MATCHES = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [teamsRes, playersRes, matchesRes] = await Promise.all([
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
  ]);

  const teams = teamsRes.data ?? [];
  const players = playersRes.data ?? [];
  const matches = matchesRes.data ?? [];

  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/signup`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
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

  return [...staticEntries, ...matchEntries, ...teamEntries, ...playerEntries];
}
