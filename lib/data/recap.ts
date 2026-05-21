import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getUserFavorites } from '@/lib/data/favorites';

type Supa = SupabaseClient<Database>;

/** Bornes ISO d'une journée locale (00:00 → 23:59:59) côté serveur. */
function dayBoundsUtc(offsetDays: number): { start: string; end: string } {
  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  day.setDate(day.getDate() + offsetDays);
  const start = new Date(day);
  const end = new Date(day);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Identifiants des compétitions trackées (= toutes celles affichées au dashboard). */
const TRACKED_IDS = [2000, 2001, 2002, 2014, 2015, 2019, 2021, 9001];

export type RecapMatchListItem = {
  match_id: number;
  kickoff_at: string;
  competition_name: string | null;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  home: { id: number | null; name: string; tla: string | null; logo_url: string | null };
  away: { id: number | null; name: string; tla: string | null; logo_url: string | null };
  /** Indique si ce match concerne un favori (favorite_team / favorite_match) */
  is_favorite: boolean;
};

export type RecapFavoriteResult = {
  match_id: number;
  competition_name: string | null;
  home: { id: number; name: string; tla: string | null };
  away: { id: number; name: string; tla: string | null };
  score_home: number;
  score_away: number;
};

export type RecapNarrative = {
  team_id: number;
  team_name: string;
  title: string;
  url: string | null;
  scraped_at: string;
  /** Slug interne si une page /news/[slug] est dispo (contenu IA généré) */
  internal_slug: string | null;
  /** Résumé IA si dispo, sinon snippet original */
  ai_summary: string | null;
};

export type DailyRecap = {
  /** Tous les matchs trackés aujourd'hui (toutes compétitions trackées) */
  matches_today: RecapMatchListItem[];
  /** Sous-ensemble : ceux qui impliquent un favori */
  matches_today_favorites: RecapMatchListItem[];
  /** Résultats d'hier (24h passées) des équipes/matchs favoris */
  favorite_results_yesterday: RecapFavoriteResult[];
  /** Dernières news scrapées (< 36h) pour les équipes favorites */
  latest_favorite_narratives: RecapNarrative[];
};

export async function getDailyRecap(
  supabase: Supa,
  userId: string,
): Promise<DailyRecap> {
  const favs = await getUserFavorites(supabase, userId);
  const teamIds = favs
    .filter((f) => f.entity_type === 'team')
    .map((f) => f.entity_id);
  const matchIds = favs
    .filter((f) => f.entity_type === 'match')
    .map((f) => f.entity_id);

  const today = dayBoundsUtc(0);
  const yesterday = dayBoundsUtc(-1);
  const thirtySixHoursAgo = new Date(
    Date.now() - 36 * 60 * 60 * 1000,
  ).toISOString();

  // 1. Matchs trackés aujourd'hui (toutes compétitions) — liste complète
  const { data: todayRaw } = await supabase
    .from('matches')
    .select(
      `id, kickoff_at, status, home_team_id, away_team_id,
       competition:competitions(name),
       home_team:teams!matches_home_team_id_fkey(id, name, tla, logo_url),
       away_team:teams!matches_away_team_id_fkey(id, name, tla, logo_url)`,
    )
    .in('competition_id', TRACKED_IDS)
    .gte('kickoff_at', today.start)
    .lte('kickoff_at', today.end)
    .order('kickoff_at', { ascending: true });

  type TodayRow = {
    id: number;
    kickoff_at: string;
    status: RecapMatchListItem['status'];
    home_team_id: number | null;
    away_team_id: number | null;
    competition: { name: string } | null;
    home_team: {
      id: number;
      name: string;
      tla: string | null;
      logo_url: string | null;
    } | null;
    away_team: {
      id: number;
      name: string;
      tla: string | null;
      logo_url: string | null;
    } | null;
  };
  const teamSet = new Set(teamIds);
  const matchSet = new Set(matchIds);
  const matchesToday: RecapMatchListItem[] = ((todayRaw ?? []) as TodayRow[]).map(
    (m) => {
      const isFav =
        matchSet.has(m.id) ||
        (m.home_team_id != null && teamSet.has(m.home_team_id)) ||
        (m.away_team_id != null && teamSet.has(m.away_team_id));
      return {
        match_id: m.id,
        kickoff_at: m.kickoff_at,
        competition_name: m.competition?.name ?? null,
        status: m.status,
        home: {
          id: m.home_team?.id ?? m.home_team_id,
          name: m.home_team?.name ?? 'À déterminer',
          tla: m.home_team?.tla ?? null,
          logo_url: m.home_team?.logo_url ?? null,
        },
        away: {
          id: m.away_team?.id ?? m.away_team_id,
          name: m.away_team?.name ?? 'À déterminer',
          tla: m.away_team?.tla ?? null,
          logo_url: m.away_team?.logo_url ?? null,
        },
        is_favorite: isFav,
      };
    },
  );
  const matchesTodayFavorites = matchesToday.filter((m) => m.is_favorite);

  // 3. Résultats d'hier des favoris
  let favoriteResultsYesterday: RecapFavoriteResult[] = [];
  if (teamIds.length > 0 || matchIds.length > 0) {
    const filters: string[] = [];
    if (teamIds.length > 0) {
      filters.push(`home_team_id.in.(${teamIds.join(',')})`);
      filters.push(`away_team_id.in.(${teamIds.join(',')})`);
    }
    if (matchIds.length > 0) {
      filters.push(`id.in.(${matchIds.join(',')})`);
    }
    const { data: ydMatches } = await supabase
      .from('matches')
      .select(
        `id, score_home, score_away,
         competition:competitions(name),
         home_team:teams!matches_home_team_id_fkey(id, name, tla),
         away_team:teams!matches_away_team_id_fkey(id, name, tla)`,
      )
      .or(filters.join(','))
      .eq('status', 'finished')
      .gte('kickoff_at', yesterday.start)
      .lte('kickoff_at', yesterday.end)
      .order('kickoff_at', { ascending: false });

    type Row = {
      id: number;
      score_home: number | null;
      score_away: number | null;
      competition: { name: string } | null;
      home_team: { id: number; name: string; tla: string | null } | null;
      away_team: { id: number; name: string; tla: string | null } | null;
    };
    favoriteResultsYesterday = ((ydMatches ?? []) as Row[])
      .filter(
        (r) =>
          r.score_home != null && r.score_away != null && r.home_team && r.away_team,
      )
      .map((r) => ({
        match_id: r.id,
        competition_name: r.competition?.name ?? null,
        home: r.home_team!,
        away: r.away_team!,
        score_home: r.score_home!,
        score_away: r.score_away!,
      }));
  }

  // 4. Dernières news des équipes favorites (< 36h)
  let latestNarratives: RecapNarrative[] = [];
  if (teamIds.length > 0) {
    const { data: narrRows } = await supabase
      .from('team_narratives')
      .select(
        `team_id, title, url, scraped_at, slug, ai_summary,
         team:teams(name)`,
      )
      .in('team_id', teamIds)
      .gte('scraped_at', thirtySixHoursAgo)
      .order('scraped_at', { ascending: false })
      .limit(5);

    type Row = {
      team_id: number;
      title: string;
      url: string | null;
      scraped_at: string;
      slug: string | null;
      ai_summary: string | null;
      team: { name: string } | null;
    };
    latestNarratives = ((narrRows ?? []) as Row[]).map((r) => ({
      team_id: r.team_id,
      team_name: r.team?.name ?? '—',
      title: r.title,
      url: r.url,
      scraped_at: r.scraped_at,
      internal_slug: r.slug,
      ai_summary: r.ai_summary,
    }));
  }

  return {
    matches_today: matchesToday,
    matches_today_favorites: matchesTodayFavorites,
    favorite_results_yesterday: favoriteResultsYesterday,
    latest_favorite_narratives: latestNarratives,
  };
}
