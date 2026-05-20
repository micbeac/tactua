// Test end-to-end pipeline post-match.
// Lancer : node --env-file=.env.local scripts/test-post-match-analysis.ts <matchId>

import { generatePostMatchAnalysis } from '../lib/openai/analyses.ts';
import { upsertAnalysis } from '../lib/data/analysis.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const matchId = Number(process.argv[2]);
if (!Number.isFinite(matchId)) {
  console.error(
    'Usage: node --env-file=.env.local scripts/test-post-match-analysis.ts <matchId>',
  );
  process.exit(1);
}

const supabase = createAdminClient();

async function main() {
  console.log(`▶ Chargement du match ${matchId}…`);
  const { data: match, error } = await supabase
    .from('matches')
    .select(
      `id, kickoff_at, status, stage, matchday, venue,
       score_home, score_away, half_time_home, half_time_away,
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
    status: string;
    stage: string | null;
    matchday: number | null;
    venue: string | null;
    score_home: number | null;
    score_away: number | null;
    half_time_home: number | null;
    half_time_away: number | null;
    competition: { id: number; name: string; country: string | null } | null;
    home_team: { id: number; name: string; country: string | null } | null;
    away_team: { id: number; name: string; country: string | null } | null;
  };

  if (m.status !== 'finished') {
    throw new Error(
      `Le match ${matchId} n'est pas terminé (status: ${m.status})`,
    );
  }
  if (
    m.score_home == null ||
    m.score_away == null ||
    !m.home_team ||
    !m.away_team
  ) {
    throw new Error('Match sans score ou sans équipes');
  }

  console.log(
    `  ${m.home_team.name} ${m.score_home} - ${m.score_away} ${m.away_team.name}`,
  );

  const ctx = {
    competition: m.competition?.name ?? 'Compétition inconnue',
    stage_or_matchday:
      m.stage ?? (m.matchday != null ? `Journée ${m.matchday}` : null),
    kickoff_at_iso: m.kickoff_at,
    venue: m.venue,
    home: {
      name: m.home_team.name,
      country: m.home_team.country,
      score: m.score_home,
      half_time_score: m.half_time_home,
      starting_eleven: [] as string[],
    },
    away: {
      name: m.away_team.name,
      country: m.away_team.country,
      score: m.score_away,
      half_time_score: m.half_time_away,
      starting_eleven: [] as string[],
    },
  };

  console.log('▶ Appel gpt-4o-mini…');
  const t0 = Date.now();
  const { analysis, model, usage } = await generatePostMatchAnalysis(ctx);
  const elapsed = Date.now() - t0;
  console.log(
    `  OK en ${elapsed}ms (in: ${usage.input}t / out: ${usage.output}t)`,
  );
  console.log('\n--- Analyse générée ---');
  console.log(JSON.stringify(analysis, null, 2));

  console.log('\n▶ Persist dans match_analyses…');
  await upsertAnalysis(supabase, m.id, 'post_match', analysis, model);
  console.log('  OK');

  console.log('\n✅ Pipeline post-match validée.');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
