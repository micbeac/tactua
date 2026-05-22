// Données complémentaires (coach + H2H) pour enrichir les pronos CDM.

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchHeadToHead, type H2HSummary } from '@/lib/api-football/deep-stats';

export type CoachInfo = {
  name: string;
  nationality: string | null;
};

/**
 * Récupère le coach actuel pour chaque team_id depuis le cache Supabase.
 */
export async function getCoachesMap(
  supabase: SupabaseClient,
  teamIds: number[],
): Promise<Map<number, CoachInfo>> {
  const out = new Map<number, CoachInfo>();
  if (teamIds.length === 0) return out;

  const { data } = await supabase
    .from('team_coaches')
    .select('team_id, name, nationality')
    .in('team_id', teamIds);

  for (const r of (data ?? []) as Array<{
    team_id: number;
    name: string;
    nationality: string | null;
  }>) {
    out.set(r.team_id, { name: r.name, nationality: r.nationality });
  }
  return out;
}

/**
 * Formate un coach pour injection dans le prompt.
 */
export function formatCoach(coach: CoachInfo | undefined): string {
  if (!coach) return 'sélectionneur inconnu';
  if (coach.nationality && coach.nationality !== '') {
    return `${coach.name} (${coach.nationality})`;
  }
  return coach.name;
}

/**
 * Récupère le H2H AF entre 2 équipes (live, pas de cache).
 * Si l'appel échoue, renvoie null — le prompt s'adapte.
 */
export async function fetchH2HForPrediction(
  afTeamIdA: number,
  afTeamIdB: number,
): Promise<H2HSummary | null> {
  try {
    return await fetchHeadToHead(afTeamIdA, afTeamIdB, 5);
  } catch (e) {
    console.error('[wc-extras] H2H failed', e);
    return null;
  }
}

/**
 * Formate un H2H pour injection dans le prompt.
 * Renvoie une ligne courte du type :
 *   "12 confrontations historiques · A 5 victoires - B 4 - 3 nuls. Derniers : Brésil 2-1 Argentine (2024, Copa America), ..."
 */
export function formatH2HForPrompt(
  h2h: H2HSummary | null,
  nameA: string,
  nameB: string,
): string {
  if (!h2h || h2h.total === 0) return 'aucune confrontation historique connue';

  const head = `${h2h.total} confrontation${h2h.total > 1 ? 's' : ''} historique${h2h.total > 1 ? 's' : ''} · ${nameA} ${h2h.a_wins} v · ${nameB} ${h2h.b_wins} v · ${h2h.draws} nul${h2h.draws > 1 ? 's' : ''}`;
  if (h2h.last_5.length === 0) return head;

  const recent = h2h.last_5
    .map((m) => `${m.date.slice(0, 4)}: ${m.score} (${m.competition})`)
    .join(' / ');
  return `${head}. Derniers : ${recent}`;
}
