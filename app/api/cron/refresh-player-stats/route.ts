// Cron : refresh des stats joueurs par compétition.
// Pour chaque équipe ayant un api_football_id dans une compétition trackée,
// récupère les stats agrégées via API-Football et upsert dans player_season_stats.
//
// Auth : header `Authorization: Bearer ${CRON_SECRET}`.
// Pas dans vercel.json (limite 2 cron sur Hobby) : à invoquer manuellement
// pour l'instant, ou depuis une orchestration externe.
//
// Quota AF : ~3 req par équipe × ~110 équipes ≈ 330 req par run. À lancer
// 1× par semaine en production (les stats évoluent lentement entre matchs).

import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import {
  TRACKED_COMPETITIONS,
  type TrackedCompetitionCode,
} from '@/lib/cron/competitions';
import { fetchTopPerformers } from '@/lib/api-football/deep-stats';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 300; // refresh long : 110 équipes × ~3 req
export const dynamic = 'force-dynamic';

const SEASON = 2025; // saison 2025-26

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const codeFilter = url.searchParams.get('code') as
    | TrackedCompetitionCode
    | null;

  const supabase = createAdminClient();

  type CronError = { team: string; competition: string; message: string };
  const stats = {
    competitions: 0,
    teams: 0,
    rows_upserted: 0,
    rows_unmapped: 0,
    errors: [] as CronError[],
  };

  const comps = codeFilter
    ? TRACKED_COMPETITIONS.filter((c) => c.code === codeFilter)
    : TRACKED_COMPETITIONS.filter((c) => c.code !== 'WC');

  for (const comp of comps) {
    // Équipes ayant joué dans cette compétition + api_football_id non null
    const { data: matchRows } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id')
      .eq('competition_id', comp.fd_id)
      .not('home_team_id', 'is', null)
      .not('away_team_id', 'is', null);

    const teamIds = new Set<number>();
    for (const m of (matchRows ?? []) as Array<{
      home_team_id: number;
      away_team_id: number;
    }>) {
      teamIds.add(m.home_team_id);
      teamIds.add(m.away_team_id);
    }
    if (teamIds.size === 0) continue;

    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, api_football_id')
      .in('id', Array.from(teamIds))
      .not('api_football_id', 'is', null);

    type TeamRow = { id: number; name: string; api_football_id: number };
    const list = (teams ?? []) as TeamRow[];

    for (const t of list) {
      try {
        const perfs = await fetchTopPerformers(
          t.api_football_id,
          comp.af_league_id,
          SEASON,
          100,
        );
        if (perfs.length === 0) continue;

        const afIds = perfs.map((p) => p.player_id);
        const { data: dbPlayers } = await supabase
          .from('players')
          .select('id, api_football_id')
          .in('api_football_id', afIds);
        const afToDb = new Map<number, number>();
        for (const p of (dbPlayers ?? []) as Array<{
          id: number;
          api_football_id: number;
        }>) {
          afToDb.set(p.api_football_id, p.id);
        }

        const rows: Array<{
          player_id: number;
          competition_id: number;
          season: string;
          appearances: number;
          minutes: number;
          goals: number;
          assists: number;
          yellow_cards: number;
          red_cards: number;
        }> = [];

        for (const p of perfs) {
          const dbId = afToDb.get(p.player_id);
          if (!dbId) {
            stats.rows_unmapped += 1;
            continue;
          }
          rows.push({
            player_id: dbId,
            competition_id: comp.fd_id,
            season: String(SEASON),
            appearances: p.appearances,
            minutes: p.minutes,
            goals: p.goals,
            assists: p.assists,
            yellow_cards: p.yellow_cards,
            red_cards: p.red_cards,
          });
        }

        if (rows.length > 0) {
          const { error } = await supabase
            .from('player_season_stats')
            .upsert(rows, {
              onConflict: 'player_id,competition_id,season',
            });
          if (error) throw new Error(`upsert: ${error.message}`);
          stats.rows_upserted += rows.length;
        }
        stats.teams += 1;
      } catch (e) {
        stats.errors.push({
          team: t.name,
          competition: comp.label,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
    stats.competitions += 1;
  }

  console.log('[cron:refresh-player-stats]', stats);
  return NextResponse.json({ ok: stats.errors.length === 0, stats });
}
