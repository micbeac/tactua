// Helpers pour récupérer les effectifs des sélections CDM, à injecter dans
// les prompts de prédiction. On limite à ~10 joueurs par équipe pour garder
// les prompts compacts.
//
// Les joueurs viennent de national_team_squads (alimenté par
// scripts/backfill-national-team-squads.ts).

import type { SupabaseClient } from '@supabase/supabase-js';

export type SquadPlayer = {
  name: string;
  position: string | null;
  shirt_number: number | null;
  club: string | null;
};

const POSITION_ORDER: Record<string, number> = {
  Goalkeeper: 0,
  G: 0,
  Defender: 1,
  D: 1,
  Midfielder: 2,
  M: 2,
  Attacker: 3,
  F: 3,
};

function posOrder(pos: string | null): number {
  if (!pos) return 9;
  return POSITION_ORDER[pos] ?? POSITION_ORDER[pos[0]?.toUpperCase() ?? ''] ?? 9;
}

/**
 * Renvoie un Map<team_id, SquadPlayer[]> pour la liste de team_ids passée.
 * Triés : GK → DEF → MID → ATT, puis numéro maillot croissant, puis nom.
 * Limite : top 10 joueurs par équipe (suffit pour le prompt).
 */
export async function getWCSquads(
  supabase: SupabaseClient,
  teamIds: number[],
  limitPerTeam = 10,
): Promise<Map<number, SquadPlayer[]>> {
  const out = new Map<number, SquadPlayer[]>();
  if (teamIds.length === 0) return out;

  const { data } = await supabase
    .from('national_team_squads')
    .select(
      `team_id, position, shirt_number,
       player:players(name, current_team:teams!players_current_team_id_fkey(name))`,
    )
    .in('team_id', teamIds);

  type Row = {
    team_id: number;
    position: string | null;
    shirt_number: number | null;
    player: {
      name: string;
      current_team: { name: string } | null;
    } | null;
  };

  for (const r of (data ?? []) as unknown as Row[]) {
    if (!r.player) continue;
    const list = out.get(r.team_id) ?? [];
    list.push({
      name: r.player.name,
      position: r.position,
      shirt_number: r.shirt_number,
      club: r.player.current_team?.name ?? null,
    });
    out.set(r.team_id, list);
  }

  for (const [teamId, list] of out.entries()) {
    list.sort((a, b) => {
      const pa = posOrder(a.position);
      const pb = posOrder(b.position);
      if (pa !== pb) return pa - pb;
      if (a.shirt_number != null && b.shirt_number != null) {
        if (a.shirt_number !== b.shirt_number) {
          return a.shirt_number - b.shirt_number;
        }
      } else if (a.shirt_number != null) return -1;
      else if (b.shirt_number != null) return 1;
      return a.name.localeCompare(b.name);
    });
    out.set(teamId, list.slice(0, limitPerTeam));
  }

  return out;
}

/**
 * Format texte compact pour injection dans un prompt LLM.
 * Ex: "1 Maignan (GK, Milan), 4 Saliba (DEF, Arsenal), 6 Tchouaméni (MID, Real Madrid), ..."
 */
export function formatSquadForPrompt(players: SquadPlayer[]): string {
  if (players.length === 0) return 'effectif non récupéré';
  return players
    .map((p) => {
      const num = p.shirt_number != null ? `${p.shirt_number} ` : '';
      const pos = p.position ? ` (${shortPos(p.position)}` : ' (';
      const club = p.club ? `, ${p.club})` : ')';
      const tail = pos === ' (' ? '' : pos + club;
      return `${num}${p.name}${tail}`;
    })
    .join(', ');
}

function shortPos(pos: string): string {
  if (!pos) return '';
  const map: Record<string, string> = {
    Goalkeeper: 'GK',
    G: 'GK',
    Defender: 'DEF',
    D: 'DEF',
    Midfielder: 'MID',
    M: 'MID',
    Attacker: 'ATT',
    F: 'ATT',
  };
  return map[pos] ?? pos;
}
