// Cron : résout players.api_football_id pour les effectifs non mappés.
//
// Pendant du cron map-teams. Sans ce mapping, un joueur n'est pas reliable à
// sa fiche, le simulateur d'absence ne peut pas le proposer, et ses stats
// détaillées n'ont nulle part où atterrir.
//
// Traite en priorité les équipes comptant le plus de joueurs non mappés, et
// s'arrête sur un budget de temps : un appel API par équipe, et les fonctions
// Hobby coupent à 60 s. Des passages successifs finissent par tout couvrir.
//
//   GET /api/cron/map-players            → équipes les moins bien mappées
//   GET /api/cron/map-players?team=123   → une équipe précise (id interne)
//
// Auth : header `Authorization: Bearer ${CRON_SECRET}`.

import { NextResponse } from 'next/server';
import { mapPlayersForTeam } from '@/lib/api-football/player-mapping';
import { requireCronAuth } from '@/lib/cron/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const TIME_BUDGET_MS = 45_000;
/** Plafond d'équipes par run, pour rester loin de la limite par minute. */
const MAX_TEAMS = 12;
/** Fenêtre de matchs à venir définissant les équipes à mapper en priorité. */
const UPCOMING_WINDOW_DAYS = 14;

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const teamFilter = Number(url.searchParams.get('team')) || null;

  const supabase = createAdminClient();

  // Équipes candidates : celles qui ont un id API-Football (sans quoi on ne
  // peut pas récupérer leur effectif).
  let query = supabase
    .from('teams')
    .select('id, name, api_football_id')
    .not('api_football_id', 'is', null);
  if (teamFilter) query = query.eq('id', teamFilter);

  const { data: teams } = await query;
  const candidates = (teams ?? []) as Array<{
    id: number;
    name: string;
    api_football_id: number;
  }>;

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, results: [], note: 'aucune équipe éligible' });
  }

  // Priorité aux équipes qui JOUENT BIENTÔT.
  //
  // Trier par « le plus de joueurs non mappés » paraissait logique mais
  // visait à côté : ce sont les sélections nationales de la Coupe du Monde
  // qui remontaient en tête, alors que leurs effectifs ne servent plus à
  // aucune analyse. Ce qu'on veut mapper, c'est ce qui va être analysé.
  const horizon = new Date(
    Date.now() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: upcoming } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id')
    .eq('status', 'scheduled')
    .gte('kickoff_at', new Date().toISOString())
    .lte('kickoff_at', horizon);

  const playingSoon = new Set<number>();
  for (const m of (upcoming ?? []) as Array<{
    home_team_id: number | null;
    away_team_id: number | null;
  }>) {
    if (m.home_team_id) playingSoon.add(m.home_team_id);
    if (m.away_team_id) playingSoon.add(m.away_team_id);
  }

  // Parmi elles, celles qui ont le plus de joueurs non résolus.
  const { data: unmapped } = await supabase
    .from('players')
    .select('current_team_id')
    .is('api_football_id', null)
    .not('current_team_id', 'is', null);

  const gapByTeam = new Map<number, number>();
  for (const p of (unmapped ?? []) as Array<{ current_team_id: number }>) {
    gapByTeam.set(
      p.current_team_id,
      (gapByTeam.get(p.current_team_id) ?? 0) + 1,
    );
  }

  const ordered = teamFilter
    ? candidates
    : candidates
        .filter(
          (t) => playingSoon.has(t.id) && (gapByTeam.get(t.id) ?? 0) > 0,
        )
        .sort((a, b) => (gapByTeam.get(b.id) ?? 0) - (gapByTeam.get(a.id) ?? 0))
        .slice(0, MAX_TEAMS);

  const startedAt = Date.now();
  const results = [];
  const skipped: string[] = [];
  const errors: Array<{ team: string; message: string }> = [];

  for (const t of ordered) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      skipped.push(t.name);
      continue;
    }
    try {
      results.push(
        await mapPlayersForTeam(supabase, t.id, t.api_football_id, t.name),
      );
    } catch (e) {
      errors.push({
        team: t.name,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const total = results.reduce((s, r) => s + r.newly_mapped, 0);
  const payload = {
    teams_considered: ordered.length,
    total_newly_mapped: total,
    results,
    skipped,
    errors,
  };
  console.log('[cron:map-players]', JSON.stringify(payload));
  return NextResponse.json({ ok: errors.length === 0, ...payload });
}
