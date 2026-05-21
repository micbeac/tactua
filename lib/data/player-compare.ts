import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { RadarDimension, StatComparison } from '@/lib/openai/types';

type Supa = SupabaseClient<Database>;

export type PlayerSnapshot = {
  id: number;
  name: string;
  photo_url: string | null;
  position: string | null;
  shirt_number: number | null;
  date_of_birth: string | null;
  nationality: string | null;
  team_name: string | null;
  team_logo: string | null;
  team_id: number | null;
  // Stats agrégées toutes compés
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
};

export type PlayerCompareData = {
  player_a: PlayerSnapshot;
  player_b: PlayerSnapshot;
  radar: RadarDimension[];
  stats_compare: StatComparison[];
};

const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));

function scoreGoals(p: PlayerSnapshot): number {
  // 20 buts = 100%
  return clamp((p.goals / 20) * 100);
}

function scoreAssists(p: PlayerSnapshot): number {
  // 10 passes décisives = 100%
  return clamp((p.assists / 10) * 100);
}

function scoreAppearances(p: PlayerSnapshot): number {
  // 30 titularisations = 100%
  return clamp((p.appearances / 30) * 100);
}

function scoreProductivity(p: PlayerSnapshot): number {
  if (p.appearances === 0) return 0;
  // (buts + assists) par match : 1.0 par match = 100%
  return clamp(((p.goals + p.assists) / p.appearances) * 100);
}

function scoreDiscipline(p: PlayerSnapshot): number {
  // Sans aucun carton : 100%. Chaque jaune = -8, chaque rouge = -25.
  const malus = p.yellow_cards * 8 + p.red_cards * 25;
  return clamp(100 - malus);
}

function adv(a: number, b: number): 'home' | 'away' | 'equal' {
  if (Math.abs(a - b) < 0.05) return 'equal';
  return a > b ? 'home' : 'away';
}

function advInverse(a: number, b: number): 'home' | 'away' | 'equal' {
  if (Math.abs(a - b) < 0.05) return 'equal';
  return a < b ? 'home' : 'away';
}

async function loadPlayerSnapshot(
  supabase: Supa,
  playerId: number,
): Promise<PlayerSnapshot | null> {
  const { data: player } = await supabase
    .from('players')
    .select(
      `id, name, photo_url, position, shirt_number, date_of_birth, nationality,
       current_team:teams!players_current_team_id_fkey(id, name, logo_url)`,
    )
    .eq('id', playerId)
    .maybeSingle();
  if (!player) return null;

  // Agrège stats toutes compétitions
  const { data: stats } = await supabase
    .from('player_season_stats')
    .select('appearances, minutes, goals, assists, yellow_cards, red_cards')
    .eq('player_id', playerId);

  type StatRow = {
    appearances: number | null;
    minutes: number | null;
    goals: number | null;
    assists: number | null;
    yellow_cards: number | null;
    red_cards: number | null;
  };
  const totals = {
    appearances: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    yellow_cards: 0,
    red_cards: 0,
  };
  for (const s of (stats ?? []) as StatRow[]) {
    totals.appearances += s.appearances ?? 0;
    totals.minutes += s.minutes ?? 0;
    totals.goals += s.goals ?? 0;
    totals.assists += s.assists ?? 0;
    totals.yellow_cards += s.yellow_cards ?? 0;
    totals.red_cards += s.red_cards ?? 0;
  }

  type CurrentTeam = { id: number; name: string; logo_url: string | null } | null;
  const team = (player as { current_team: CurrentTeam }).current_team;

  return {
    id: player.id,
    name: player.name,
    photo_url: player.photo_url,
    position: player.position,
    shirt_number: player.shirt_number,
    date_of_birth: player.date_of_birth,
    nationality: player.nationality,
    team_id: team?.id ?? null,
    team_name: team?.name ?? null,
    team_logo: team?.logo_url ?? null,
    ...totals,
  };
}

function buildStatsCompare(
  a: PlayerSnapshot,
  b: PlayerSnapshot,
): StatComparison[] {
  const out: StatComparison[] = [];
  out.push({
    label: 'Titularisations',
    home: String(a.appearances),
    away: String(b.appearances),
    advantage: adv(a.appearances, b.appearances),
  });
  out.push({
    label: 'Minutes jouées',
    home: String(a.minutes),
    away: String(b.minutes),
    advantage: adv(a.minutes, b.minutes),
  });
  out.push({
    label: 'Buts',
    home: String(a.goals),
    away: String(b.goals),
    advantage: adv(a.goals, b.goals),
  });
  out.push({
    label: 'Passes décisives',
    home: String(a.assists),
    away: String(b.assists),
    advantage: adv(a.assists, b.assists),
  });
  const aProd =
    a.appearances > 0 ? (a.goals + a.assists) / a.appearances : 0;
  const bProd =
    b.appearances > 0 ? (b.goals + b.assists) / b.appearances : 0;
  out.push({
    label: 'Productivité (B+A)/match',
    home: aProd.toFixed(2),
    away: bProd.toFixed(2),
    advantage: adv(aProd, bProd),
  });
  out.push({
    label: 'Cartons jaunes',
    home: String(a.yellow_cards),
    away: String(b.yellow_cards),
    advantage: advInverse(a.yellow_cards, b.yellow_cards),
  });
  out.push({
    label: 'Cartons rouges',
    home: String(a.red_cards),
    away: String(b.red_cards),
    advantage: advInverse(a.red_cards, b.red_cards),
  });
  return out;
}

export async function getPlayerCompare(
  supabase: Supa,
  playerAId: number,
  playerBId: number,
): Promise<PlayerCompareData | null> {
  const [a, b] = await Promise.all([
    loadPlayerSnapshot(supabase, playerAId),
    loadPlayerSnapshot(supabase, playerBId),
  ]);
  if (!a || !b) return null;

  const radar: RadarDimension[] = [
    {
      label: 'Buts',
      home: Math.round(scoreGoals(a)),
      away: Math.round(scoreGoals(b)),
    },
    {
      label: 'Passes',
      home: Math.round(scoreAssists(a)),
      away: Math.round(scoreAssists(b)),
    },
    {
      label: 'Apparitions',
      home: Math.round(scoreAppearances(a)),
      away: Math.round(scoreAppearances(b)),
    },
    {
      label: 'Productivité',
      home: Math.round(scoreProductivity(a)),
      away: Math.round(scoreProductivity(b)),
    },
    {
      label: 'Discipline',
      home: Math.round(scoreDiscipline(a)),
      away: Math.round(scoreDiscipline(b)),
    },
  ];

  return {
    player_a: a,
    player_b: b,
    radar,
    stats_compare: buildStatsCompare(a, b),
  };
}
