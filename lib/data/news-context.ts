// Récupère le contexte éditorial autour d'une news : forme récente,
// position au classement, prochain match, joueurs notables.
// Utilisé pour :
//   - afficher la carte "Le club en bref" sur la page news
//   - alimenter l'auto-linker (joueurs/équipes mentionnés dans le body
//     deviennent des liens internes)

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type NewsContextData = {
  team: {
    id: number;
    name: string;
    logo_url: string | null;
    country: string | null;
  };
  competition: { name: string } | null;
  position: number | null;
  recent_form: ('W' | 'D' | 'L')[];
  next_match: {
    id: number;
    kickoff_at: string;
    opponent: { id: number; name: string; logo_url: string | null } | null;
    is_home: boolean;
  } | null;
  /** Joueurs de l'équipe (pour l'auto-linker) — top 30 par notoriété */
  players: Array<{ id: number; name: string }>;
};

export async function getNewsContext(
  supabase: Supa,
  teamId: number,
): Promise<NewsContextData | null> {
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, logo_url, country')
    .eq('id', teamId)
    .maybeSingle();
  if (!team) return null;

  const [seasonRes, nextRes, playersRes] = await Promise.all([
    supabase
      .from('team_season_stats')
      .select('position, form_last_5, competition:competitions(name)')
      .eq('team_id', teamId)
      .order('points', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('matches')
      .select(
        `id, kickoff_at, home_team_id, away_team_id,
         home_team:teams!matches_home_team_id_fkey(id, name, logo_url),
         away_team:teams!matches_away_team_id_fkey(id, name, logo_url)`,
      )
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq('status', 'scheduled')
      .gte('kickoff_at', new Date().toISOString())
      .order('kickoff_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('players')
      .select('id, name')
      .eq('current_team_id', teamId)
      .order('id', { ascending: true })
      .limit(50),
  ]);

  type SeasonRow = {
    position: number | null;
    form_last_5: string[] | null;
    competition: { name: string } | null;
  };
  type NextRow = {
    id: number;
    kickoff_at: string;
    home_team_id: number | null;
    away_team_id: number | null;
    home_team: { id: number; name: string; logo_url: string | null } | null;
    away_team: { id: number; name: string; logo_url: string | null } | null;
  };
  const season = seasonRes.data as unknown as SeasonRow | null;
  const next = nextRes.data as unknown as NextRow | null;
  const players = (playersRes.data ?? []) as { id: number; name: string }[];

  const recentForm =
    (season?.form_last_5 ?? []).filter(
      (r): r is 'W' | 'D' | 'L' => r === 'W' || r === 'D' || r === 'L',
    ) ?? [];

  let nextMatch: NewsContextData['next_match'] = null;
  if (next) {
    const isHome = next.home_team_id === teamId;
    const opp = isHome ? next.away_team : next.home_team;
    nextMatch = {
      id: next.id,
      kickoff_at: next.kickoff_at,
      opponent: opp
        ? { id: opp.id, name: opp.name, logo_url: opp.logo_url }
        : null,
      is_home: isHome,
    };
  }

  return {
    team: {
      id: team.id,
      name: team.name,
      logo_url: team.logo_url,
      country: team.country,
    },
    competition: season?.competition ? { name: season.competition.name } : null,
    position: season?.position ?? null,
    recent_form: recentForm,
    next_match: nextMatch,
    players,
  };
}
