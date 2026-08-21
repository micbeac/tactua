// Mapping Football-Data ↔ API-Football des joueurs.
//
// Pendant du mapping d'équipes (team-mapping.ts), et tout aussi structurant :
// sans `players.api_football_id`, un joueur n'est pas reliable à sa fiche, le
// simulateur d'absence ne peut pas le proposer, et ses statistiques
// détaillées n'ont nulle part où atterrir.
//
// Le problème s'est vu sur Arsenal - Coventry : les joueurs d'Arsenal
// portaient un `db_player_id`, ceux de Coventry non — le promu n'ayant jamais
// été mappé. Le simulateur ne proposait donc aucun joueur visiteur.
//
// Comme pour les équipes, ce mapping n'existait que sous forme de script
// manuel lancé une fois en mai.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { fetchSquad } from './deep-stats';

type Supa = SupabaseClient<Database>;

/** Normalise un nom : sans accents, sans casse, sans ponctuation. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

type DbPlayer = { id: number; name: string; api_football_id: number | null };

export type PlayerMappingStats = {
  team: string;
  squad_size: number;
  newly_mapped: number;
  already_mapped: number;
  unmatched: string[];
};

/**
 * Résout `players.api_football_id` pour l'effectif d'une équipe.
 *
 * Trois passes, de la plus sûre à la plus permissive : nom complet normalisé,
 * inclusion d'un nom dans l'autre, puis nom de famille seul (au moins 4
 * lettres, pour éviter les collisions sur des noms courts). C'est ce qui
 * permet de rapprocher « R. James », « Reece James » et « Reece Nelson James ».
 *
 * Un identifiant déjà attribué à un autre joueur n'est jamais réutilisé : la
 * colonne porte un index unique, un doublon ferait échouer toute la passe.
 */
export async function mapPlayersForTeam(
  supabase: Supa,
  dbTeamId: number,
  afTeamId: number,
  teamName: string,
): Promise<PlayerMappingStats> {
  const stats: PlayerMappingStats = {
    team: teamName,
    squad_size: 0,
    newly_mapped: 0,
    already_mapped: 0,
    unmatched: [],
  };

  const squad = await fetchSquad(afTeamId);
  stats.squad_size = squad.length;
  if (squad.length === 0) return stats;

  const { data } = await supabase
    .from('players')
    .select('id, name, api_football_id')
    .eq('current_team_id', dbTeamId)
    .order('id', { ascending: true });

  const dbList = (data ?? []) as DbPlayer[];
  if (dbList.length === 0) return stats;

  // Le row le plus ancien (id le plus petit) fait foi : c'est en général la
  // ligne d'origine Football-Data, celle vers laquelle pointent les autres
  // tables.
  const byNorm = new Map<string, DbPlayer>();
  const byLast = new Map<string, DbPlayer>();
  for (const p of dbList) {
    const n = normalize(p.name);
    if (!byNorm.has(n)) byNorm.set(n, p);
    const parts = p.name.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    if (last && last.length >= 4) {
      const ln = normalize(last);
      if (!byLast.has(ln)) byLast.set(ln, p);
    }
  }

  const taken = new Set<number>(
    dbList.map((p) => p.api_football_id).filter((v): v is number => v != null),
  );

  for (const af of squad) {
    const n = normalize(af.name);
    let hit = byNorm.get(n);

    if (!hit) {
      for (const [dbNorm, p] of byNorm) {
        if (dbNorm.length >= 4 && (dbNorm.includes(n) || n.includes(dbNorm))) {
          hit = p;
          break;
        }
      }
    }
    if (!hit) {
      const parts = af.name.trim().split(/\s+/);
      const last = parts[parts.length - 1];
      if (last && last.length >= 4) hit = byLast.get(normalize(last));
    }

    if (!hit) {
      stats.unmatched.push(af.name);
      continue;
    }
    if (hit.api_football_id === af.player_id) {
      stats.already_mapped += 1;
      continue;
    }
    if (hit.api_football_id != null || taken.has(af.player_id)) {
      // Le joueur DB porte déjà un autre id, ou cet id est pris ailleurs :
      // on ne touche à rien plutôt que de casser un mapping valide.
      stats.unmatched.push(`${af.name} (conflit)`);
      continue;
    }

    const { error } = await supabase
      .from('players')
      .update({ api_football_id: af.player_id })
      .eq('id', hit.id);
    if (error) {
      stats.unmatched.push(`${af.name} (échec : ${error.message})`);
      continue;
    }
    taken.add(af.player_id);
    hit.api_football_id = af.player_id;
    stats.newly_mapped += 1;
  }

  return stats;
}
