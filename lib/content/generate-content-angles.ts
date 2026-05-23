// Orchestrateur de génération d'angles vidéo TikTok pour Tactuo.
// Pull les matchs éligibles (post-match récents OU pré-match J-2) sans angles
// générés, construit leur contexte, appelle gpt-4o pour 3 angles + leurs
// livrables, insère le tout dans content_angles.

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildAngleContext } from './build-angle-context.ts';
import {
  generateAngles,
  generateDeliverables,
  type AngleProposal,
} from '@/lib/openai/content-angles';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type GenerateOptions = {
  /** Cible un seul match (mode bouton admin). */
  matchIdFilter?: number | null;
  /** Nombre max de matchs traités par run. Défaut 3. */
  limit?: number;
  /** Fenêtre pre-match : matchs scheduled dans les N heures à venir. Défaut 48. */
  preMatchHorizonHours?: number;
  /** Fenêtre post-match : matchs finished dans les N heures passées. Défaut 24. */
  postMatchLookbackHours?: number;
  /** Force la régénération même si déjà fait. */
  force?: boolean;
  /** Callback de progression. */
  onProgress?: (msg: string) => void;
};

export type GenerateStats = {
  matches_processed: number;
  angles_inserted: number;
  errors: Array<{ match_id: number; phase: string; message: string }>;
};

type EligibleMatch = { id: number; phase: 'pre_match' | 'post_match' };

async function pickEligibleMatches(
  supabase: Supa,
  opts: GenerateOptions,
): Promise<EligibleMatch[]> {
  const limit = opts.limit ?? 3;
  const force = opts.force ?? false;

  // Mode "un seul match" : phase déduite du status (finished → post, sinon pre).
  if (opts.matchIdFilter != null) {
    const { data } = await supabase
      .from('matches')
      .select('id, status, angles_generated_at')
      .eq('id', opts.matchIdFilter)
      .maybeSingle();
    if (!data) return [];
    if (!force && data.angles_generated_at) return [];
    return [
      {
        id: data.id,
        phase: data.status === 'finished' ? 'post_match' : 'pre_match',
      },
    ];
  }

  const nowIso = new Date().toISOString();
  const horizon = opts.preMatchHorizonHours ?? 48;
  const lookback = opts.postMatchLookbackHours ?? 24;
  const horizonIso = new Date(
    Date.now() + horizon * 60 * 60 * 1000,
  ).toISOString();
  const lookbackIso = new Date(
    Date.now() - lookback * 60 * 60 * 1000,
  ).toISOString();

  // Post-match : finished dans les X dernières heures
  let postQ = supabase
    .from('matches')
    .select('id')
    .eq('status', 'finished')
    .gte('kickoff_at', lookbackIso)
    .order('kickoff_at', { ascending: false })
    .limit(limit);
  if (!force) postQ = postQ.is('angles_generated_at', null);
  const { data: postRows } = await postQ;

  // Pre-match : scheduled dans les X prochaines heures
  let preQ = supabase
    .from('matches')
    .select('id')
    .eq('status', 'scheduled')
    .gte('kickoff_at', nowIso)
    .lte('kickoff_at', horizonIso)
    .order('kickoff_at', { ascending: true })
    .limit(limit);
  if (!force) preQ = preQ.is('angles_generated_at', null);
  const { data: preRows } = await preQ;

  const eligible: EligibleMatch[] = [];
  for (const r of (postRows ?? []) as Array<{ id: number }>) {
    eligible.push({ id: r.id, phase: 'post_match' });
  }
  for (const r of (preRows ?? []) as Array<{ id: number }>) {
    eligible.push({ id: r.id, phase: 'pre_match' });
  }
  return eligible.slice(0, limit);
}

async function processMatch(
  supabase: Supa,
  match: EligibleMatch,
  stats: GenerateStats,
  log: (m: string) => void,
): Promise<void> {
  log(`▶ Match ${match.id} (${match.phase})`);
  try {
    const ctx = await buildAngleContext(supabase, match.id, match.phase);
    if (!ctx) {
      stats.errors.push({
        match_id: match.id,
        phase: match.phase,
        message: 'Contexte indisponible',
      });
      return;
    }

    const { angles, model } = await generateAngles(ctx);
    log(`  → ${angles.length} angles générés`);

    for (const angle of angles) {
      try {
        const { deliverables, model: dModel } = await generateDeliverables(
          angle,
          ctx,
        );
        const { error: insertErr } = await supabase
          .from('content_angles')
          .insert(buildInsertRow(angle, deliverables, match, dModel));
        if (insertErr) throw new Error(insertErr.message);
        stats.angles_inserted += 1;
      } catch (e) {
        stats.errors.push({
          match_id: match.id,
          phase: match.phase,
          message: `Livrables: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }

    // Marque le match comme traité même si certains livrables ont échoué.
    await supabase
      .from('matches')
      .update({ angles_generated_at: new Date().toISOString() })
      .eq('id', match.id);

    stats.matches_processed += 1;
    void model;
    log(`  ✅ Match ${match.id} traité`);
  } catch (e) {
    stats.errors.push({
      match_id: match.id,
      phase: match.phase,
      message: e instanceof Error ? e.message : String(e),
    });
    log(`  ✗ Match ${match.id} : ${e instanceof Error ? e.message : e}`);
  }
}

function buildInsertRow(
  angle: AngleProposal,
  deliverables: Awaited<ReturnType<typeof generateDeliverables>>['deliverables'],
  match: EligibleMatch,
  model: string,
) {
  return {
    match_id: match.id,
    generation_phase: match.phase,
    format: angle.format,
    hook: angle.hook,
    title: angle.title,
    data_points: angle.data_points,
    narrative: angle.narrative,
    joueur_principal: angle.joueur_principal,
    club_principal: angle.club_principal,
    championnat: angle.championnat,
    score_viralite: angle.score_viralite,
    cta_tactuo: angle.cta_tactuo,
    urgence: angle.urgence,
    script_timecode: deliverables.script_timecode,
    prompt_elevenlabs: deliverables.prompt_elevenlabs,
    prompts_visuels_ia: deliverables.prompts_visuels_ia,
    sources_visuels_a_chercher: deliverables.sources_visuels_a_chercher,
    instructions_capcut: deliverables.instructions_capcut,
    caption_tiktok: deliverables.caption_tiktok,
    hashtags: deliverables.hashtags,
    status: 'pending' as const,
    ai_model: model,
  };
}

export async function runGenerateContentAngles(
  supabase: Supa,
  opts: GenerateOptions = {},
): Promise<GenerateStats> {
  const log = opts.onProgress ?? (() => {});
  const stats: GenerateStats = {
    matches_processed: 0,
    angles_inserted: 0,
    errors: [],
  };

  const matches = await pickEligibleMatches(supabase, opts);
  log(`▶ ${matches.length} match(s) à traiter`);

  // Séquentiel : on est limité par le rate-limit OpenAI + on veut des logs
  // ordonnés. Les matchs sont peu nombreux par run (3 par défaut) donc OK.
  for (const m of matches) {
    await processMatch(supabase, m, stats, log);
  }

  return stats;
}
