import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { RadarDimension, StatComparison } from '@/lib/openai/types';

type Supa = SupabaseClient<Database>;

export type TeamCompareData = {
  team_a: TeamSnapshot;
  team_b: TeamSnapshot;
  radar: RadarDimension[];
  stats_compare: StatComparison[];
  /** Forme récente W/D/L de chaque équipe (5 derniers matchs joués) */
  form_a: ('W' | 'D' | 'L')[];
  form_b: ('W' | 'D' | 'L')[];
  /** H2H récap V/N/D (point de vue team_a) */
  h2h: { a_wins: number; draws: number; b_wins: number; total: number };
};

export type TeamSnapshot = {
  id: number;
  name: string;
  tla: string | null;
  logo_url: string | null;
  country: string | null;
  /** Compétition principale (1re par points) */
  competition_name: string | null;
  season: string | null;
  position: number | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  points: number;
};

const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));

function scoreAttack(snap: TeamSnapshot): number {
  if (snap.played === 0) return 50;
  return clamp((snap.goals_for / snap.played) * 33);
}

function scoreDefense(snap: TeamSnapshot): number {
  if (snap.played === 0) return 50;
  const conceded = snap.goals_against / snap.played;
  return clamp((2.5 - conceded) * 40);
}

function scoreWinRate(snap: TeamSnapshot): number {
  if (snap.played === 0) return 50;
  return clamp((snap.wins / snap.played) * 100);
}

function scoreConsistency(snap: TeamSnapshot): number {
  if (snap.played === 0) return 50;
  return clamp(((snap.wins + snap.draws) / snap.played) * 100);
}

function scoreOverall(snap: TeamSnapshot): number {
  if (snap.played === 0) return 50;
  return clamp((snap.points / (snap.played * 3)) * 100);
}

function adv(a: number, b: number): 'home' | 'away' | 'equal' {
  if (Math.abs(a - b) < 0.05) return 'equal';
  return a > b ? 'home' : 'away';
}

function advInverse(a: number, b: number): 'home' | 'away' | 'equal' {
  if (Math.abs(a - b) < 0.05) return 'equal';
  return a < b ? 'home' : 'away';
}

async function loadTeamSnapshot(
  supabase: Supa,
  teamId: number,
): Promise<TeamSnapshot | null> {
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, tla, logo_url, country')
    .eq('id', teamId)
    .maybeSingle();
  if (!team) return null;

  // On prend la compétition principale (la 1re par points DESC)
  const { data: stats } = await supabase
    .from('team_season_stats')
    .select(
      `position, played, wins, draws, losses, goals_for, goals_against, points,
       season, competition:competitions(name)`,
    )
    .eq('team_id', teamId)
    .order('points', { ascending: false })
    .limit(1);

  type StatRow = {
    position: number | null;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
    points: number;
    season: string;
    competition: { name: string } | null;
  };
  const s = (stats?.[0] ?? null) as StatRow | null;
  return {
    id: team.id,
    name: team.name,
    tla: team.tla,
    logo_url: team.logo_url,
    country: team.country,
    competition_name: s?.competition?.name ?? null,
    season: s?.season ?? null,
    position: s?.position ?? null,
    played: s?.played ?? 0,
    wins: s?.wins ?? 0,
    draws: s?.draws ?? 0,
    losses: s?.losses ?? 0,
    goals_for: s?.goals_for ?? 0,
    goals_against: s?.goals_against ?? 0,
    points: s?.points ?? 0,
  };
}

async function loadRecentForm(
  supabase: Supa,
  teamId: number,
): Promise<('W' | 'D' | 'L')[]> {
  const { data } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, score_home, score_away')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq('status', 'finished')
    .order('kickoff_at', { ascending: false })
    .limit(5);

  type Row = {
    home_team_id: number;
    away_team_id: number;
    score_home: number | null;
    score_away: number | null;
  };
  const out: ('W' | 'D' | 'L')[] = [];
  for (const r of (data ?? []) as Row[]) {
    if (r.score_home == null || r.score_away == null) continue;
    const isHome = r.home_team_id === teamId;
    const goalsFor = isHome ? r.score_home : r.score_away;
    const goalsAgainst = isHome ? r.score_away : r.score_home;
    if (goalsFor > goalsAgainst) out.push('W');
    else if (goalsFor < goalsAgainst) out.push('L');
    else out.push('D');
  }
  return out.reverse(); // chrono : du + ancien au + récent
}

async function loadH2H(
  supabase: Supa,
  teamA: number,
  teamB: number,
): Promise<{ a_wins: number; draws: number; b_wins: number; total: number }> {
  const { data } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, score_home, score_away')
    .or(
      `and(home_team_id.eq.${teamA},away_team_id.eq.${teamB}),and(home_team_id.eq.${teamB},away_team_id.eq.${teamA})`,
    )
    .eq('status', 'finished')
    .order('kickoff_at', { ascending: false })
    .limit(15);

  let aWins = 0;
  let draws = 0;
  let bWins = 0;
  type Row = {
    home_team_id: number;
    away_team_id: number;
    score_home: number | null;
    score_away: number | null;
  };
  for (const r of (data ?? []) as Row[]) {
    if (r.score_home == null || r.score_away == null) continue;
    if (r.score_home === r.score_away) draws += 1;
    else {
      const winnerId =
        r.score_home > r.score_away ? r.home_team_id : r.away_team_id;
      if (winnerId === teamA) aWins += 1;
      else bWins += 1;
    }
  }
  return {
    a_wins: aWins,
    draws,
    b_wins: bWins,
    total: aWins + draws + bWins,
  };
}

function buildStatsCompare(a: TeamSnapshot, b: TeamSnapshot): StatComparison[] {
  const out: StatComparison[] = [];
  out.push({
    label: 'Matchs joués',
    home: String(a.played),
    away: String(b.played),
    advantage: 'equal',
  });
  out.push({
    label: 'Victoires',
    home: String(a.wins),
    away: String(b.wins),
    advantage: adv(a.wins, b.wins),
  });
  out.push({
    label: 'Buts/match',
    home: a.played > 0 ? (a.goals_for / a.played).toFixed(2) : '0',
    away: b.played > 0 ? (b.goals_for / b.played).toFixed(2) : '0',
    advantage: adv(
      a.played > 0 ? a.goals_for / a.played : 0,
      b.played > 0 ? b.goals_for / b.played : 0,
    ),
  });
  out.push({
    label: 'Buts encaissés/match',
    home: a.played > 0 ? (a.goals_against / a.played).toFixed(2) : '0',
    away: b.played > 0 ? (b.goals_against / b.played).toFixed(2) : '0',
    advantage: advInverse(
      a.played > 0 ? a.goals_against / a.played : 0,
      b.played > 0 ? b.goals_against / b.played : 0,
    ),
  });
  out.push({
    label: 'Différence de buts',
    home: String(a.goals_for - a.goals_against),
    away: String(b.goals_for - b.goals_against),
    advantage: adv(a.goals_for - a.goals_against, b.goals_for - b.goals_against),
  });
  out.push({
    label: 'Position',
    home: a.position ? `${a.position}e` : '—',
    away: b.position ? `${b.position}e` : '—',
    advantage:
      a.position && b.position
        ? advInverse(a.position, b.position)
        : 'equal',
  });
  out.push({
    label: 'Points',
    home: String(a.points),
    away: String(b.points),
    advantage: adv(a.points, b.points),
  });
  return out;
}

export async function getTeamCompare(
  supabase: Supa,
  teamAId: number,
  teamBId: number,
): Promise<TeamCompareData | null> {
  const [a, b] = await Promise.all([
    loadTeamSnapshot(supabase, teamAId),
    loadTeamSnapshot(supabase, teamBId),
  ]);
  if (!a || !b) return null;

  const [formA, formB, h2h] = await Promise.all([
    loadRecentForm(supabase, teamAId),
    loadRecentForm(supabase, teamBId),
    loadH2H(supabase, teamAId, teamBId),
  ]);

  const radar: RadarDimension[] = [
    {
      label: 'Attaque',
      home: Math.round(scoreAttack(a)),
      away: Math.round(scoreAttack(b)),
    },
    {
      label: 'Défense',
      home: Math.round(scoreDefense(a)),
      away: Math.round(scoreDefense(b)),
    },
    {
      label: 'Victoires',
      home: Math.round(scoreWinRate(a)),
      away: Math.round(scoreWinRate(b)),
    },
    {
      label: 'Régularité',
      home: Math.round(scoreConsistency(a)),
      away: Math.round(scoreConsistency(b)),
    },
    {
      label: 'Globale',
      home: Math.round(scoreOverall(a)),
      away: Math.round(scoreOverall(b)),
    },
  ];

  return {
    team_a: a,
    team_b: b,
    radar,
    stats_compare: buildStatsCompare(a, b),
    form_a: formA,
    form_b: formB,
    h2h,
  };
}

/** Liste pour autocomplete : équipes ayant des stats (sinon comparaison vide). */
export async function searchTeamsForCompare(
  supabase: Supa,
  query: string,
  limit = 20,
): Promise<Array<{ id: number; name: string; logo_url: string | null }>> {
  const { data } = await supabase
    .from('teams')
    .select('id, name, logo_url')
    .ilike('name', `%${query}%`)
    .not('api_football_id', 'is', null)
    .order('name', { ascending: true })
    .limit(limit);
  return (data ?? []) as Array<{
    id: number;
    name: string;
    logo_url: string | null;
  }>;
}
