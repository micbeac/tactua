// Test bout-en-bout de la pipeline d'analyse pré-match.
// 1. Charge un match depuis Supabase (avec teams + forme + H2H)
// 2. Construit le contexte
// 3. Appelle gpt-4o-mini
// 4. Persiste dans match_analyses
//
// Lancer : node --env-file=.env.local scripts/test-pre-match-analysis.ts <matchId>

import { getHeadToHead, getTeamForm } from '../lib/data/match.ts';
import { generatePreMatchAnalysis } from '../lib/openai/analyses.ts';
import { upsertAnalysis } from '../lib/data/analysis.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const matchId = Number(process.argv[2]);
if (!Number.isFinite(matchId)) {
  console.error(
    'Usage: node --env-file=.env.local scripts/test-pre-match-analysis.ts <matchId>',
  );
  process.exit(1);
}

const supabase = createAdminClient();

async function main() {
  console.log(`▶ Chargement du match ${matchId}…`);
  const { data: match, error } = await supabase
    .from('matches')
    .select(
      `id, kickoff_at, stage, matchday, venue, home_team_id, away_team_id,
       competition:competitions(id, name, country),
       home_team:teams!matches_home_team_id_fkey(id, name, country),
       away_team:teams!matches_away_team_id_fkey(id, name, country)`,
    )
    .eq('id', matchId)
    .single();
  if (error || !match) throw error ?? new Error('match not found');

  const m = match as unknown as {
    id: number;
    kickoff_at: string;
    stage: string | null;
    matchday: number | null;
    venue: string | null;
    home_team_id: number | null;
    away_team_id: number | null;
    competition: { id: number; name: string; country: string | null } | null;
    home_team: { id: number; name: string; country: string | null } | null;
    away_team: { id: number; name: string; country: string | null } | null;
  };

  console.log(`  ${m.home_team?.name} vs ${m.away_team?.name}`);

  if (!m.home_team_id || !m.away_team_id || !m.home_team || !m.away_team) {
    throw new Error('Match avec équipes TBD — analyse pré-match impossible');
  }

  console.log('▶ Récupération de la forme et du H2H…');
  const [homeForm, awayForm, h2h] = await Promise.all([
    getTeamForm(supabase, m.home_team_id, m.id, 5),
    getTeamForm(supabase, m.away_team_id, m.id, 5),
    getHeadToHead(supabase, m.home_team_id, m.away_team_id, m.id, 5),
  ]);

  const ctx = {
    competition: m.competition?.name ?? 'Compétition inconnue',
    stage_or_matchday:
      m.stage ?? (m.matchday != null ? `Journée ${m.matchday}` : null),
    kickoff_at_iso: m.kickoff_at,
    venue: m.venue,
    home: {
      name: m.home_team.name,
      country: m.home_team.country,
      recent_form: homeForm.map((f) => f.result),
      starting_eleven: [] as string[], // free tier : pas de lineup
    },
    away: {
      name: m.away_team.name,
      country: m.away_team.country,
      recent_form: awayForm.map((f) => f.result),
      starting_eleven: [] as string[],
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
  };

  console.log('▶ Appel gpt-4o-mini…');
  const t0 = Date.now();
  const { analysis, model, usage } = await generatePreMatchAnalysis(ctx);
  const elapsed = Date.now() - t0;
  console.log(
    `  OK en ${elapsed}ms (in: ${usage.input}t / out: ${usage.output}t)`,
  );
  console.log('\n--- Analyse générée ---');
  console.log(JSON.stringify(analysis, null, 2));

  console.log('\n▶ Persist dans match_analyses…');
  await upsertAnalysis(supabase, m.id, 'pre_match', analysis, model);
  console.log('  OK');

  console.log('\n✅ Pipeline validée.');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
