// Endpoint qui scanne et génère les analyses IA manquantes :
// - pré-match : pour les matchs imminents (24h) sans pré-match analysis
// - post-match : pour les matchs récemment finis (24h) sans post-match analysis
//
// Auth : header `Authorization: Bearer ${CRON_SECRET}`.
// Pas dans vercel.json (limite 2 cron sur Hobby) : à invoquer manuellement
// pour l'instant, ou depuis refresh-matchday après upgrade Pro.

import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import { getHeadToHead, getTeamForm } from '@/lib/data/match';
import { upsertAnalysis } from '@/lib/data/analysis';
import {
  generatePostMatchAnalysis,
  generatePreMatchAnalysis,
} from '@/lib/openai/analyses';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const PRE_WINDOW_HOURS = 24; // analyse pré-match si kickoff dans les 24h
const POST_WINDOW_HOURS = 24; // analyse post-match si fini depuis < 24h
const MAX_PER_RUN = 5; // garde-fou anti-explosion de coût

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();
  const now = new Date();

  type CronError = { match_id: number; step: string; message: string };
  const stats = {
    pre_generated: 0,
    post_generated: 0,
    errors: [] as CronError[],
  };

  // ============================================================================
  // 1. PRÉ-MATCH : matchs imminents sans analyse, avec équipes connues
  // ============================================================================
  const preUpper = new Date(now.getTime() + PRE_WINDOW_HOURS * 60 * 60 * 1000);
  const { data: preCandidates } = await supabase
    .from('matches')
    .select(
      `id, kickoff_at, stage, matchday, venue, home_team_id, away_team_id,
       competition:competitions(id, name),
       home_team:teams!matches_home_team_id_fkey(id, name, country),
       away_team:teams!matches_away_team_id_fkey(id, name, country),
       match_analyses!left(type)`,
    )
    .in('status', ['scheduled', 'live'])
    .gte('kickoff_at', now.toISOString())
    .lte('kickoff_at', preUpper.toISOString())
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null)
    .order('kickoff_at', { ascending: true })
    .limit(MAX_PER_RUN * 2); // sur-fetch puis filtre côté JS

  type PreCandidate = {
    id: number;
    kickoff_at: string;
    stage: string | null;
    matchday: number | null;
    venue: string | null;
    home_team_id: number | null;
    away_team_id: number | null;
    competition: { id: number; name: string } | null;
    home_team: { id: number; name: string; country: string | null } | null;
    away_team: { id: number; name: string; country: string | null } | null;
    match_analyses: Array<{ type: 'pre_match' | 'post_match' }>;
  };

  const preList = ((preCandidates ?? []) as unknown as PreCandidate[])
    .filter((m) => !m.match_analyses?.some((a) => a.type === 'pre_match'))
    .slice(0, MAX_PER_RUN);

  for (const m of preList) {
    try {
      if (!m.home_team_id || !m.away_team_id || !m.home_team || !m.away_team)
        continue;
      const [homeForm, awayForm, h2h] = await Promise.all([
        getTeamForm(supabase, m.home_team_id, m.id, 5),
        getTeamForm(supabase, m.away_team_id, m.id, 5),
        getHeadToHead(supabase, m.home_team_id, m.away_team_id, m.id, 5),
      ]);
      const { analysis, model } = await generatePreMatchAnalysis({
        competition: m.competition?.name ?? 'Compétition',
        stage_or_matchday:
          m.stage ?? (m.matchday != null ? `Journée ${m.matchday}` : null),
        kickoff_at_iso: m.kickoff_at,
        venue: m.venue,
        home: {
          name: m.home_team.name,
          country: m.home_team.country,
          recent_form: homeForm.map((f) => f.result),
          starting_eleven: [],
        },
        away: {
          name: m.away_team.name,
          country: m.away_team.country,
          recent_form: awayForm.map((f) => f.result),
          starting_eleven: [],
        },
        head_to_head: h2h
          .filter((h) => h.home_team_id != null && h.away_team_id != null)
          .map((h) => ({
            date: h.kickoff_at.slice(0, 10),
            home_team:
              h.home_team_id === m.home_team_id
                ? (m.home_team?.name ?? '?')
                : (m.away_team?.name ?? '?'),
            away_team:
              h.away_team_id === m.home_team_id
                ? (m.home_team?.name ?? '?')
                : (m.away_team?.name ?? '?'),
            score_home: h.score_home,
            score_away: h.score_away,
          })),
      });
      await upsertAnalysis(supabase, m.id, 'pre_match', analysis, model);
      stats.pre_generated += 1;
    } catch (e) {
      stats.errors.push({
        match_id: m.id,
        step: 'pre_match',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // ============================================================================
  // 2. POST-MATCH : matchs récemment finis sans analyse
  // ============================================================================
  const postLower = new Date(
    now.getTime() - POST_WINDOW_HOURS * 60 * 60 * 1000,
  );
  const { data: postCandidates } = await supabase
    .from('matches')
    .select(
      `id, kickoff_at, stage, matchday, venue,
       score_home, score_away, half_time_home, half_time_away,
       competition:competitions(id, name),
       home_team:teams!matches_home_team_id_fkey(id, name, country),
       away_team:teams!matches_away_team_id_fkey(id, name, country),
       match_analyses!left(type)`,
    )
    .eq('status', 'finished')
    .gte('kickoff_at', postLower.toISOString())
    .order('kickoff_at', { ascending: false })
    .limit(MAX_PER_RUN * 2);

  type PostCandidate = {
    id: number;
    kickoff_at: string;
    stage: string | null;
    matchday: number | null;
    venue: string | null;
    score_home: number | null;
    score_away: number | null;
    half_time_home: number | null;
    half_time_away: number | null;
    competition: { id: number; name: string } | null;
    home_team: { id: number; name: string; country: string | null } | null;
    away_team: { id: number; name: string; country: string | null } | null;
    match_analyses: Array<{ type: 'pre_match' | 'post_match' }>;
  };

  const postList = ((postCandidates ?? []) as unknown as PostCandidate[])
    .filter((m) => !m.match_analyses?.some((a) => a.type === 'post_match'))
    .filter(
      (m) =>
        m.score_home != null &&
        m.score_away != null &&
        m.home_team &&
        m.away_team,
    )
    .slice(0, MAX_PER_RUN);

  for (const m of postList) {
    try {
      const { analysis, model } = await generatePostMatchAnalysis({
        competition: m.competition?.name ?? 'Compétition',
        stage_or_matchday:
          m.stage ?? (m.matchday != null ? `Journée ${m.matchday}` : null),
        kickoff_at_iso: m.kickoff_at,
        venue: m.venue,
        home: {
          name: m.home_team!.name,
          country: m.home_team!.country,
          score: m.score_home!,
          half_time_score: m.half_time_home,
          starting_eleven: [],
        },
        away: {
          name: m.away_team!.name,
          country: m.away_team!.country,
          score: m.score_away!,
          half_time_score: m.half_time_away,
          starting_eleven: [],
        },
      });
      await upsertAnalysis(supabase, m.id, 'post_match', analysis, model);
      stats.post_generated += 1;
    } catch (e) {
      stats.errors.push({
        match_id: m.id,
        step: 'post_match',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log('[cron:generate-analysis]', stats);
  return NextResponse.json({ ok: stats.errors.length === 0, stats });
}
