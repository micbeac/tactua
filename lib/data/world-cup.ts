// Helpers data pour la Coupe du Monde 2026.
// Format : 48 équipes, 12 groupes (A-L) de 4 équipes.
// Top 2 + 8 meilleurs 3e → 1/16 → 1/8 → quarts → demis → finale.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export const WC_COMPETITION_ID = 2000;
export const WC_GROUP_LETTERS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
] as const;
export type WCGroupLetter = (typeof WC_GROUP_LETTERS)[number];

export type WCTeam = {
  id: number;
  name: string;
  tla: string | null;
  logo_url: string | null;
  country: string | null;
};

export type WCGroupStanding = {
  letter: WCGroupLetter;
  teams: Array<{
    team: WCTeam;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
    goal_diff: number;
    points: number;
    position: number | null;
  }>;
};

export type WCGroupPrediction = {
  group_letter: WCGroupLetter;
  ranking: Array<{
    position: number;
    team_id: number;
    team_name: string;
    reasoning: string;
  }>;
  summary: string;
  generated_at: string;
  ai_model: string | null;
};

export type WCMatch = {
  id: number;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  stage: string | null;
  score_home: number | null;
  score_away: number | null;
  live_minute: number | null;
  home: WCTeam | null;
  away: WCTeam | null;
};

const MATCH_SELECT = `
  id, kickoff_at, status, stage, score_home, score_away, live_minute,
  home_team_id, away_team_id,
  home_team:teams!matches_home_team_id_fkey(id, name, tla, logo_url, country),
  away_team:teams!matches_away_team_id_fkey(id, name, tla, logo_url, country)
`;

/**
 * Tous les matchs CDM dans l'ordre de kickoff_at.
 */
export async function getAllWCMatches(supabase: Supa): Promise<WCMatch[]> {
  const { data } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('competition_id', WC_COMPETITION_ID)
    .order('kickoff_at', { ascending: true });

  type Row = {
    id: number;
    kickoff_at: string;
    status: WCMatch['status'];
    stage: string | null;
    score_home: number | null;
    score_away: number | null;
    live_minute: number | null;
    home_team_id: number | null;
    away_team_id: number | null;
    home_team: WCTeam | null;
    away_team: WCTeam | null;
  };
  return ((data ?? []) as unknown as Row[]).map((m) => ({
    id: m.id,
    kickoff_at: m.kickoff_at,
    status: m.status,
    stage: m.stage,
    score_home: m.score_home,
    score_away: m.score_away,
    live_minute: m.live_minute,
    home: m.home_team,
    away: m.away_team,
  }));
}

/**
 * IDs des sélections nationales de la Coupe du Monde.
 * Deux sources fusionnées pour être robuste avant/après l'intégration du
 * tirage au sort : les équipes ayant une sélection importée
 * (national_team_squads) et celles présentes dans les matchs CDM.
 */
export async function getWCNationalTeamIds(supabase: Supa): Promise<number[]> {
  const ids = new Set<number>();
  const [squadRes, matchRes] = await Promise.all([
    supabase.from('national_team_squads').select('team_id').limit(5000),
    supabase
      .from('matches')
      .select('home_team_id, away_team_id')
      .eq('competition_id', WC_COMPETITION_ID),
  ]);
  for (const r of (squadRes.data ?? []) as { team_id: number | null }[]) {
    if (r.team_id != null) ids.add(r.team_id);
  }
  for (const r of (matchRes.data ?? []) as {
    home_team_id: number | null;
    away_team_id: number | null;
  }[]) {
    if (r.home_team_id != null) ids.add(r.home_team_id);
    if (r.away_team_id != null) ids.add(r.away_team_id);
  }
  return Array.from(ids);
}

/**
 * Mapping team_id → groupe, depuis wc_group_assignments.
 */
export async function getGroupAssignments(
  supabase: Supa,
): Promise<Map<number, WCGroupLetter>> {
  const { data } = await supabase
    .from('wc_group_assignments')
    .select('team_id, group_letter');
  const map = new Map<number, WCGroupLetter>();
  for (const r of (data ?? []) as {
    team_id: number;
    group_letter: string;
  }[]) {
    if ((WC_GROUP_LETTERS as readonly string[]).includes(r.group_letter)) {
      map.set(r.team_id, r.group_letter as WCGroupLetter);
    }
  }
  return map;
}

/**
 * Calcule le classement live des 12 groupes en fonction des matchs
 * GROUP_STAGE finished + en cours. Si la CDM n'a pas démarré, tous les
 * compteurs sont à 0.
 */
export async function getGroupStandings(
  supabase: Supa,
): Promise<WCGroupStanding[]> {
  const [assignments, matchesRes, teamsRes] = await Promise.all([
    getGroupAssignments(supabase),
    supabase
      .from('matches')
      .select(
        'id, status, score_home, score_away, home_team_id, away_team_id, stage',
      )
      .eq('competition_id', WC_COMPETITION_ID)
      .eq('stage', 'GROUP_STAGE'),
    supabase
      .from('teams')
      .select('id, name, tla, logo_url, country'),
  ]);

  type TeamRow = WCTeam;
  const teamById = new Map<number, TeamRow>();
  for (const t of (teamsRes.data ?? []) as TeamRow[]) {
    teamById.set(t.id, t);
  }

  // Init buckets par groupe
  const groups = new Map<WCGroupLetter, WCGroupStanding>();
  for (const letter of WC_GROUP_LETTERS) {
    groups.set(letter, { letter, teams: [] });
  }

  // Init stats par team
  const teamStats = new Map<
    number,
    {
      played: number;
      wins: number;
      draws: number;
      losses: number;
      goals_for: number;
      goals_against: number;
      points: number;
    }
  >();
  for (const teamId of assignments.keys()) {
    teamStats.set(teamId, {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      points: 0,
    });
  }

  type MatchRow = {
    id: number;
    status: WCMatch['status'];
    score_home: number | null;
    score_away: number | null;
    home_team_id: number | null;
    away_team_id: number | null;
    stage: string | null;
  };
  // Compte uniquement les matchs finished avec score
  for (const m of (matchesRes.data ?? []) as MatchRow[]) {
    if (
      m.status !== 'finished' ||
      m.score_home == null ||
      m.score_away == null ||
      m.home_team_id == null ||
      m.away_team_id == null
    )
      continue;
    const h = teamStats.get(m.home_team_id);
    const a = teamStats.get(m.away_team_id);
    if (!h || !a) continue;
    h.played += 1;
    a.played += 1;
    h.goals_for += m.score_home;
    h.goals_against += m.score_away;
    a.goals_for += m.score_away;
    a.goals_against += m.score_home;
    if (m.score_home > m.score_away) {
      h.wins += 1;
      h.points += 3;
      a.losses += 1;
    } else if (m.score_home < m.score_away) {
      a.wins += 1;
      a.points += 3;
      h.losses += 1;
    } else {
      h.draws += 1;
      a.draws += 1;
      h.points += 1;
      a.points += 1;
    }
  }

  // Dispatch dans les groupes
  for (const [teamId, letter] of assignments.entries()) {
    const team = teamById.get(teamId);
    if (!team) continue;
    const stats = teamStats.get(teamId)!;
    const group = groups.get(letter)!;
    group.teams.push({
      team,
      played: stats.played,
      wins: stats.wins,
      draws: stats.draws,
      losses: stats.losses,
      goals_for: stats.goals_for,
      goals_against: stats.goals_against,
      goal_diff: stats.goals_for - stats.goals_against,
      points: stats.points,
      position: null,
    });
  }

  // Tri par points DESC, GD DESC, GF DESC, alphabetic ASC
  for (const group of groups.values()) {
    group.teams.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.goal_diff !== b.goal_diff) return b.goal_diff - a.goal_diff;
      if (a.goals_for !== b.goals_for) return b.goals_for - a.goals_for;
      return a.team.name.localeCompare(b.team.name);
    });
    // Position calculée pour affichage
    group.teams.forEach((t, i) => {
      t.position = i + 1;
    });
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.letter.localeCompare(b.letter),
  );
}

/**
 * Récupère toutes les prédictions de groupe enregistrées.
 */
export async function getGroupPredictions(
  supabase: Supa,
): Promise<Map<WCGroupLetter, WCGroupPrediction>> {
  const { data } = await supabase
    .from('wc_group_predictions')
    .select('group_letter, content_json, ai_model, generated_at');
  const map = new Map<WCGroupLetter, WCGroupPrediction>();
  for (const r of (data ?? []) as {
    group_letter: string;
    content_json: unknown;
    ai_model: string | null;
    generated_at: string;
  }[]) {
    if (!(WC_GROUP_LETTERS as readonly string[]).includes(r.group_letter))
      continue;
    const content = r.content_json as {
      ranking: WCGroupPrediction['ranking'];
      summary: string;
    };
    map.set(r.group_letter as WCGroupLetter, {
      group_letter: r.group_letter as WCGroupLetter,
      ranking: content.ranking ?? [],
      summary: content.summary ?? '',
      generated_at: r.generated_at,
      ai_model: r.ai_model,
    });
  }
  return map;
}

/**
 * Groupe les matchs par stage (GROUP_STAGE, LAST_16, LAST_8, SEMI_FINALS, FINAL).
 */
export function groupMatchesByStage(matches: WCMatch[]): {
  GROUP_STAGE: WCMatch[];
  LAST_16: WCMatch[];
  QUARTER_FINALS: WCMatch[];
  SEMI_FINALS: WCMatch[];
  THIRD_PLACE: WCMatch[];
  FINAL: WCMatch[];
  OTHER: WCMatch[];
} {
  const out = {
    GROUP_STAGE: [] as WCMatch[],
    LAST_16: [] as WCMatch[],
    QUARTER_FINALS: [] as WCMatch[],
    SEMI_FINALS: [] as WCMatch[],
    THIRD_PLACE: [] as WCMatch[],
    FINAL: [] as WCMatch[],
    OTHER: [] as WCMatch[],
  };
  for (const m of matches) {
    const stage = (m.stage ?? '').toUpperCase();
    if (stage === 'GROUP_STAGE' || stage === 'GROUP') out.GROUP_STAGE.push(m);
    else if (
      stage === 'LAST_16' ||
      stage === 'ROUND_OF_16' ||
      stage === 'ROUND_16'
    )
      out.LAST_16.push(m);
    else if (
      stage === 'QUARTER_FINALS' ||
      stage === 'QUARTERFINALS' ||
      stage === 'QUARTER_FINAL'
    )
      out.QUARTER_FINALS.push(m);
    else if (stage === 'SEMI_FINALS' || stage === 'SEMIFINALS')
      out.SEMI_FINALS.push(m);
    else if (stage === 'THIRD_PLACE') out.THIRD_PLACE.push(m);
    else if (stage === 'FINAL') out.FINAL.push(m);
    else out.OTHER.push(m);
  }
  return out;
}
