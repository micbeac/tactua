import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type SearchTeam = {
  id: number;
  name: string;
  tla: string | null;
  logo_url: string | null;
  country: string | null;
};

export type SearchPlayer = {
  id: number;
  name: string;
  position: string | null;
  current_team_name: string | null;
};

export type SearchResults = {
  teams: SearchTeam[];
  players: SearchPlayer[];
};

const PER_TYPE = 10;

function sanitize(q: string): string {
  // Strip caractères qui cassent les patterns PostgREST. On garde les espaces.
  return q.replace(/[\\%_]/g, '').trim();
}

export async function searchAll(
  supabase: Supa,
  q: string,
): Promise<SearchResults> {
  const cleaned = sanitize(q);
  if (cleaned.length < 2) return { teams: [], players: [] };
  const pattern = `%${cleaned}%`;

  const [teamsRes, playersRes] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, tla, logo_url, country')
      .ilike('name', pattern)
      .order('name')
      .limit(PER_TYPE),
    supabase
      .from('players')
      .select(
        'id, name, position, current_team:teams!players_current_team_id_fkey(name)',
      )
      .ilike('name', pattern)
      .order('name')
      .limit(PER_TYPE),
  ]);

  type PlayerRow = {
    id: number;
    name: string;
    position: string | null;
    current_team: { name: string } | null;
  };

  return {
    teams: (teamsRes.data ?? []) as SearchTeam[],
    players: ((playersRes.data ?? []) as unknown as PlayerRow[]).map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      current_team_name: p.current_team?.name ?? null,
    })),
  };
}
