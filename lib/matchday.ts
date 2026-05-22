// Helpers partagés pour la vue "matchs d'un jour" (accueil + API route).
// Gère le fuseau Europe/Paris et le DST automatiquement.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MatchCardProps } from '@/components/match/MatchCard';

// Mapping compétition → emoji drapeau
export const COMPETITION_FLAGS: Record<string, string> = {
  WC: '🌍',
  CL: '🇪🇺',
  PL: '🏴',
  PD: '🇪🇸',
  SA: '🇮🇹',
  BL1: '🇩🇪',
  FL1: '🇫🇷',
  BJL: '🇧🇪',
  EL: '🟠',
};

export const COMPETITION_ORDER: Record<string, number> = {
  WC: 0,
  CL: 1,
  EL: 2,
  PL: 3,
  PD: 4,
  SA: 5,
  BL1: 6,
  FL1: 7,
  BJL: 8,
};

export type DayMatchGroup = {
  code: string;
  name: string;
  flag: string;
  matches: MatchCardProps[];
};

/**
 * Renvoie [start, end] ISO UTC pour la journée Paris d'un YYYY-MM-DD.
 * Gère automatiquement DST (UTC+1 hiver, UTC+2 été).
 */
export function parisDayRange(dateYmd: string): { start: string; end: string } {
  const noonUtcMs = Date.parse(`${dateYmd}T12:00:00Z`);
  const parisHourAtNoonUtc = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Paris',
      hour: 'numeric',
      hour12: false,
    }).format(new Date(noonUtcMs)),
    10,
  );
  const offsetHours = parisHourAtNoonUtc - 12; // 1 ou 2
  const startMs = noonUtcMs - (12 + offsetHours) * 3_600_000;
  const endMs = startMs + 24 * 3_600_000;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  };
}

export function isoPrevDay(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function isoNextDay(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Date d'aujourd'hui en YYYY-MM-DD selon Paris */
export function todayParis(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' });
  return fmt.format(new Date());
}

export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

type TeamEmbed = {
  id: number;
  name: string;
  tla: string | null;
  logo_url: string | null;
} | null;

type CompetitionEmbed = {
  id: number;
  code: string | null;
  name: string;
} | null;

type MatchRow = {
  id: number;
  kickoff_at: string;
  status: MatchCardProps['status'];
  stage: string | null;
  matchday: number | null;
  score_home: number | null;
  score_away: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  competition: CompetitionEmbed;
  home_team: TeamEmbed;
  away_team: TeamEmbed;
};

const SELECT = `
  id, kickoff_at, status, stage, matchday, score_home, score_away,
  home_team_id, away_team_id,
  competition:competitions(id, code, name),
  home_team:teams!matches_home_team_id_fkey(id, name, tla, logo_url),
  away_team:teams!matches_away_team_id_fkey(id, name, tla, logo_url)
`;

function toCardProps(m: MatchRow): MatchCardProps {
  return {
    id: m.id,
    kickoff_at: m.kickoff_at,
    status: m.status,
    stage: m.stage,
    matchday: m.matchday,
    score_home: m.score_home,
    score_away: m.score_away,
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
  };
}

/**
 * Renvoie tous les matchs d'une journée Paris, groupés par compétition
 * et triés (ordre compétition puis heure de coup d'envoi).
 * `competitionId` optionnel : restreint à une seule compétition.
 */
export async function getMatchesForDay(
  supabase: SupabaseClient,
  date: string,
  competitionId?: number,
): Promise<DayMatchGroup[]> {
  const { start, end } = parisDayRange(date);
  let query = supabase
    .from('matches')
    .select(SELECT)
    .gte('kickoff_at', start)
    .lt('kickoff_at', end)
    .order('kickoff_at', { ascending: true });
  if (competitionId != null) {
    query = query.eq('competition_id', competitionId);
  }
  const { data } = await query;

  const matches = (data ?? []) as unknown as MatchRow[];

  const groupsMap = new Map<string, DayMatchGroup>();
  for (const m of matches) {
    const code = m.competition?.code ?? 'XX';
    const name = m.competition?.name ?? 'Autre';
    const g = groupsMap.get(code) ?? {
      code,
      name,
      flag: COMPETITION_FLAGS[code] ?? '⚽',
      matches: [],
    };
    g.matches.push(toCardProps(m));
    groupsMap.set(code, g);
  }

  return Array.from(groupsMap.values()).sort((a, b) => {
    const oa = COMPETITION_ORDER[a.code] ?? 99;
    const ob = COMPETITION_ORDER[b.code] ?? 99;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });
}
