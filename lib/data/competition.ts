import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type CompetitionRow = {
  id: number;
  name: string;
  code: string | null;
  country: string | null;
  current_season: string | null;
};

export async function getCompetitionByCode(
  supabase: Supa,
  code: string,
): Promise<CompetitionRow | null> {
  const { data, error } = await supabase
    .from('competitions')
    .select('id, name, code, country, current_season')
    .ilike('code', code)
    .maybeSingle();
  if (error) {
    console.error('[data/competition] byCode', error);
    return null;
  }
  return (data as CompetitionRow | null) ?? null;
}

export type CompetitionMatchRow = {
  id: number;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  stage: string | null;
  matchday: number | null;
  score_home: number | null;
  score_away: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
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

const MATCH_SELECT = `
  id, kickoff_at, status, stage, matchday, score_home, score_away,
  home_team_id, away_team_id,
  home_team:teams!matches_home_team_id_fkey(id, name, tla, logo_url),
  away_team:teams!matches_away_team_id_fkey(id, name, tla, logo_url)
`;

export async function getCompetitionUpcomingMatches(
  supabase: Supa,
  competitionId: number,
  limit = 50,
): Promise<CompetitionMatchRow[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('competition_id', competitionId)
    .in('status', ['scheduled', 'live'])
    .gte('kickoff_at', new Date().toISOString())
    .order('kickoff_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('[data/competition] upcoming', error);
    return [];
  }
  return (data ?? []) as unknown as CompetitionMatchRow[];
}

export async function getCompetitionRecentMatches(
  supabase: Supa,
  competitionId: number,
  limit = 20,
): Promise<CompetitionMatchRow[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('competition_id', competitionId)
    .eq('status', 'finished')
    .order('kickoff_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[data/competition] recent', error);
    return [];
  }
  return (data ?? []) as unknown as CompetitionMatchRow[];
}
