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
};

export type DailyRecap = {
  /** Nb de matchs trackés aujourd'hui (toutes compétitions trackées) */
  matches_today_total: number;
  /** Nb parmi ces matchs aujourd'hui qui impliquent un favori (équipe ou match) */
  matches_today_favorites: number;
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

  // 1. Matchs trackés aujourd'hui (toutes compétitions)
  const todayAllRes = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id', { count: 'exact' })
    .in('competition_id', TRACKED_IDS)
    .gte('kickoff_at', today.start)
    .lte('kickoff_at', today.end);

  const todayAll = (todayAllRes.data ?? []) as Array<{
    id: number;
    home_team_id: number | null;
    away_team_id: number | null;
  }>;
  const matchesTodayTotal = todayAllRes.count ?? todayAll.length;

  // 2. Combien d'entre eux concernent des favoris
  const teamSet = new Set(teamIds);
  const matchSet = new Set(matchIds);
  const matchesTodayFavorites = todayAll.filter(
    (m) =>
      matchSet.has(m.id) ||
      (m.home_team_id != null && teamSet.has(m.home_team_id)) ||
      (m.away_team_id != null && teamSet.has(m.away_team_id)),
  ).length;

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
        `team_id, title, url, scraped_at,
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
      team: { name: string } | null;
    };
    latestNarratives = ((narrRows ?? []) as Row[]).map((r) => ({
      team_id: r.team_id,
      team_name: r.team?.name ?? '—',
      title: r.title,
      url: r.url,
      scraped_at: r.scraped_at,
    }));
  }

  return {
    matches_today_total: matchesTodayTotal,
    matches_today_favorites: matchesTodayFavorites,
    favorite_results_yesterday: favoriteResultsYesterday,
    latest_favorite_narratives: latestNarratives,
  };
}
