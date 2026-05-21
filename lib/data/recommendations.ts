import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getUserFavorites } from '@/lib/data/favorites';

type Supa = SupabaseClient<Database>;

export type RecommendedPlayer = {
  player_id: number;
  name: string;
  photo_url: string | null;
  position: string | null;
  shirt_number: number | null;
  team_id: number;
  team_name: string;
  team_logo: string | null;
  /** Stats agrégées toutes compétitions confondues sur la saison actuelle. */
  appearances: number;
  goals: number;
  assists: number;
  /** Indique pourquoi on suggère ce joueur ("top buteur Inter", "passeur Bologna"). */
  reason: string;
};

/**
 * Suggère 6-8 joueurs au user basé sur ses équipes favorites :
 * - Top 2 par équipe favorite (par goals + assists)
 * - Exclut les joueurs déjà favoris
 * - Si aucun favori → top joueurs des compétitions principales
 */
export async function getRecommendedPlayers(
  supabase: Supa,
  userId: string,
  limit = 8,
): Promise<RecommendedPlayer[]> {
  const favs = await getUserFavorites(supabase, userId);
  const teamIds = favs
    .filter((f) => f.entity_type === 'team')
    .map((f) => f.entity_id);
  const playerIds = new Set(
    favs.filter((f) => f.entity_type === 'player').map((f) => f.entity_id),
  );

  // Aucun favori → on revient avec une liste vide (la section ne s'affichera pas)
  if (teamIds.length === 0) return [];

  // 1. Stats saison de tous les joueurs des équipes favorites
  type StatsRow = {
    player_id: number;
    appearances: number | null;
    goals: number | null;
    assists: number | null;
    player: {
      id: number;
      name: string;
      photo_url: string | null;
      position: string | null;
      shirt_number: number | null;
      current_team_id: number | null;
    } | null;
  };
  const { data: statsRaw } = await supabase
    .from('player_season_stats')
    .select(
      `player_id, appearances, goals, assists,
       player:players!inner(
         id, name, photo_url, position, shirt_number, current_team_id
       )`,
    )
    .in('player.current_team_id', teamIds);

  const statsRows = (statsRaw ?? []) as StatsRow[];

  // 2. Agréger par joueur (somme toutes compétitions)
  type Agg = {
    player_id: number;
    name: string;
    photo_url: string | null;
    position: string | null;
    shirt_number: number | null;
    team_id: number;
    appearances: number;
    goals: number;
    assists: number;
  };
  const aggMap = new Map<number, Agg>();
  for (const s of statsRows) {
    if (!s.player || !s.player.current_team_id) continue;
    if (playerIds.has(s.player.id)) continue; // déjà favori → skip
    const existing = aggMap.get(s.player_id);
    if (existing) {
      existing.appearances += s.appearances ?? 0;
      existing.goals += s.goals ?? 0;
      existing.assists += s.assists ?? 0;
    } else {
      aggMap.set(s.player_id, {
        player_id: s.player.id,
        name: s.player.name,
        photo_url: s.player.photo_url,
        position: s.player.position,
        shirt_number: s.player.shirt_number,
        team_id: s.player.current_team_id,
        appearances: s.appearances ?? 0,
        goals: s.goals ?? 0,
        assists: s.assists ?? 0,
      });
    }
  }

  // 3. Group by team et prend les top 2 par équipe
  const byTeam = new Map<number, Agg[]>();
  for (const a of aggMap.values()) {
    if (!byTeam.has(a.team_id)) byTeam.set(a.team_id, []);
    byTeam.get(a.team_id)!.push(a);
  }
  const topByTeam: Agg[] = [];
  for (const list of byTeam.values()) {
    list.sort((a, b) => b.goals + b.assists - (a.goals + a.assists));
    topByTeam.push(...list.slice(0, 2));
  }
  topByTeam.sort((a, b) => b.goals + b.assists - (a.goals + a.assists));
  const top = topByTeam.slice(0, limit);

  if (top.length === 0) return [];

  // 4. Récupérer les noms et logos des équipes pour l'affichage
  const teamIdsToFetch = Array.from(new Set(top.map((t) => t.team_id)));
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, logo_url')
    .in('id', teamIdsToFetch);
  type TeamRow = { id: number; name: string; logo_url: string | null };
  const teamById = new Map<number, TeamRow>();
  for (const t of (teams ?? []) as TeamRow[]) {
    teamById.set(t.id, t);
  }

  // 5. Construit la raison (ex: "Top buteur Inter Milan")
  function buildReason(a: Agg, teamName: string): string {
    if (a.goals >= 8) return `Top buteur ${teamName} (${a.goals}b)`;
    if (a.assists >= 6) return `Top passeur ${teamName} (${a.assists}p déc.)`;
    if (a.appearances >= 25) return `Titulaire ${teamName}`;
    return `Joueur clé ${teamName}`;
  }

  return top.map((a) => {
    const team = teamById.get(a.team_id);
    const teamName = team?.name ?? '—';
    return {
      player_id: a.player_id,
      name: a.name,
      photo_url: a.photo_url,
      position: a.position,
      shirt_number: a.shirt_number,
      team_id: a.team_id,
      team_name: teamName,
      team_logo: team?.logo_url ?? null,
      appearances: a.appearances,
      goals: a.goals,
      assists: a.assists,
      reason: buildReason(a, teamName),
    };
  });
}
