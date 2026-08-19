// Mapping Football-Data ↔ API-Football des équipes.
//
// ⚠️ Ce mapping est la clé de voûte de tout l'enrichissement : sans
// `teams.api_football_id`, on perd les compositions, les notes de joueurs, les
// stats détaillées, le xG — et la voie « deep » de l'analyse IA se désactive
// silencieusement (`canDeep` exige l'id des deux équipes).
//
// Il n'existait que sous forme de script manuel (scripts/map-teams.ts), lancé
// une fois en mai. Toutes les équipes arrivées depuis — promus de 2026-27
// compris — sont restées non mappées, et leurs matchs produisaient des
// analyses indigentes sans que rien ne le signale.
//
// D'où cette version appelable par cron.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { af } from './deep-stats';

type Supa = SupabaseClient<Database>;

type AfTeamsResponse = {
  response: Array<{
    team: { id: number; name: string; code: string | null; country: string };
  }>;
};

/**
 * Normalise un nom de club pour la comparaison : sans accents, sans casse,
 * sans suffixes juridiques (FC, CF, AC…) ni ponctuation.
 * « Paris Saint-Germain FC » et « Paris Saint Germain » se rejoignent.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|as|us|ssc|cd|rcd|afc|bk|if|sv|vfl|vfb|tsg|rc)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export type MappingStats = {
  competition: string;
  db_teams: number;
  af_teams: number;
  newly_mapped: number;
  already_mapped: number;
  unmatched: string[];
};

/**
 * Résout `teams.api_football_id` pour toutes les équipes d'une compétition.
 *
 * Stratégie de rapprochement, du plus sûr au plus permissif :
 *   1. nom normalisé exact
 *   2. code TLA (3 lettres)
 *   3. inclusion d'un nom normalisé dans l'autre
 *
 * Les équipes déjà mappées ne sont jamais retouchées : un mapping validé ne
 * doit pas pouvoir être cassé par un homonyme.
 */
export async function mapTeamsForCompetition(
  supabase: Supa,
  fdCompetitionId: number,
  afLeagueId: number,
  season: number,
  label: string,
): Promise<MappingStats> {
  const stats: MappingStats = {
    competition: label,
    db_teams: 0,
    af_teams: 0,
    newly_mapped: 0,
    already_mapped: 0,
    unmatched: [],
  };

  // Équipes ayant un match dans cette compétition.
  const { data: matchRows } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id')
    .eq('competition_id', fdCompetitionId);

  const teamIds = new Set<number>();
  for (const m of (matchRows ?? []) as Array<{
    home_team_id: number | null;
    away_team_id: number | null;
  }>) {
    if (m.home_team_id) teamIds.add(m.home_team_id);
    if (m.away_team_id) teamIds.add(m.away_team_id);
  }
  if (teamIds.size === 0) return stats;

  const { data: dbTeams } = await supabase
    .from('teams')
    .select('id, name, tla, api_football_id')
    .in('id', [...teamIds]);

  type DbTeam = {
    id: number;
    name: string;
    tla: string | null;
    api_football_id: number | null;
  };
  const list = (dbTeams ?? []) as DbTeam[];
  stats.db_teams = list.length;

  const todo = list.filter((t) => t.api_football_id == null);
  stats.already_mapped = list.length - todo.length;
  // Rien à mapper : on s'épargne l'appel API.
  if (todo.length === 0) return stats;

  const resp = await af<AfTeamsResponse>(
    `/teams?league=${afLeagueId}&season=${season}`,
  );
  stats.af_teams = resp.response.length;

  const byNorm = new Map<string, number>();
  const byCode = new Map<string, number>();
  for (const t of resp.response) {
    byNorm.set(normalize(t.team.name), t.team.id);
    if (t.team.code) byCode.set(t.team.code.toUpperCase(), t.team.id);
  }

  // Les ids AF déjà attribués à une autre équipe ne doivent pas être réutilisés :
  // la colonne porte un index unique, un doublon ferait échouer tout le lot.
  const taken = new Set<number>(
    list.map((t) => t.api_football_id).filter((v): v is number => v != null),
  );

  for (const t of todo) {
    const dbNorm = normalize(t.name);
    let hit = byNorm.get(dbNorm);
    if (hit == null && t.tla) hit = byCode.get(t.tla.toUpperCase());
    if (hit == null) {
      for (const [afNorm, afId] of byNorm) {
        if (afNorm.length >= 4 && (afNorm.includes(dbNorm) || dbNorm.includes(afNorm))) {
          hit = afId;
          break;
        }
      }
    }
    if (hit == null || taken.has(hit)) {
      stats.unmatched.push(t.name);
      continue;
    }

    const { error } = await supabase
      .from('teams')
      .update({ api_football_id: hit })
      .eq('id', t.id);
    if (error) {
      stats.unmatched.push(`${t.name} (échec écriture : ${error.message})`);
      continue;
    }
    taken.add(hit);
    stats.newly_mapped += 1;
  }

  return stats;
}
