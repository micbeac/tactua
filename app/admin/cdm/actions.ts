'use server';

import { revalidatePath } from 'next/cache';
import { getAdminUser } from '@/lib/data/admin';
import { formatSquadForPrompt, getWCSquads } from '@/lib/data/wc-squads';
import {
  WC_COMPETITION_ID,
  WC_GROUP_LETTERS,
  type WCGroupLetter,
} from '@/lib/data/world-cup';
import { generateWCGroupPrediction } from '@/lib/openai/wc-group-prediction';
import { generateWCKnockoutPrediction } from '@/lib/openai/wc-knockout-prediction';
import { createAdminClient } from '@/lib/supabase/admin';

type Result =
  | { ok: true; ok_count: number; errors: number }
  | { ok: false; message: string };

export async function regenAllGroupPredictions(): Promise<Result> {
  const admin = await getAdminUser();
  if (!admin || !admin.is_admin) {
    return { ok: false, message: 'Accès refusé' };
  }

  const supabase = createAdminClient();

  // Récupère les assignments + infos équipes
  const { data: rows } = await supabase
    .from('wc_group_assignments')
    .select('group_letter, team:teams(id, name, country)');

  type RowJoin = {
    group_letter: string;
    team: { id: number; name: string; country: string | null } | null;
  };
  const byGroup = new Map<
    WCGroupLetter,
    Array<{ team_id: number; name: string; country: string | null }>
  >();
  const allTeamIds: number[] = [];
  for (const r of (rows ?? []) as unknown as RowJoin[]) {
    if (!r.team) continue;
    if (!(WC_GROUP_LETTERS as readonly string[]).includes(r.group_letter))
      continue;
    const letter = r.group_letter as WCGroupLetter;
    const list = byGroup.get(letter) ?? [];
    list.push({
      team_id: r.team.id,
      name: r.team.name,
      country: r.team.country,
    });
    byGroup.set(letter, list);
    allTeamIds.push(r.team.id);
  }

  if (byGroup.size === 0) {
    return { ok: false, message: 'Aucun groupe peuplé' };
  }

  // Pré-charge tous les effectifs en 1 query
  const squadsMap = await getWCSquads(supabase, allTeamIds, 10);

  let okCount = 0;
  let errors = 0;
  for (const [letter, teams] of byGroup.entries()) {
    try {
      const enriched = teams.map((t) => ({
        ...t,
        squad: formatSquadForPrompt(squadsMap.get(t.team_id) ?? []),
      }));
      const { content, model } = await generateWCGroupPrediction({
        group_letter: letter,
        teams: enriched,
      });
      const { error } = await supabase.from('wc_group_predictions').upsert(
        {
          group_letter: letter,
          content_json: content,
          ai_model: model,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'group_letter' },
      );
      if (error) throw error;
      okCount++;
    } catch (e) {
      errors++;
      console.error(`[wc] group ${letter} failed:`, e);
    }
  }

  revalidatePath('/coupe-du-monde-2026');
  revalidatePath('/admin/cdm');
  return { ok: true, ok_count: okCount, errors };
}

export async function regenAllKnockoutPredictions(): Promise<Result> {
  const admin = await getAdminUser();
  if (!admin || !admin.is_admin) {
    return { ok: false, message: 'Accès refusé' };
  }

  const supabase = createAdminClient();

  // Tous les matchs phase finale avec home + away connus (pas "À déterminer")
  const { data: matches } = await supabase
    .from('matches')
    .select(
      `id, stage, kickoff_at, status,
       home_team:teams!matches_home_team_id_fkey(id, name, country),
       away_team:teams!matches_away_team_id_fkey(id, name, country)`,
    )
    .eq('competition_id', WC_COMPETITION_ID)
    .neq('stage', 'GROUP_STAGE')
    .neq('status', 'finished');

  type MatchRow = {
    id: number;
    stage: string | null;
    kickoff_at: string;
    status: string;
    home_team: { id: number; name: string; country: string | null } | null;
    away_team: { id: number; name: string; country: string | null } | null;
  };

  const targets = ((matches ?? []) as unknown as MatchRow[]).filter(
    (m) => m.home_team && m.away_team,
  );

  if (targets.length === 0) {
    return { ok: false, message: 'Aucun match KO avec 2 équipes connues' };
  }

  // Pré-charge tous les effectifs (home + away uniques)
  const uniqueTeamIds = Array.from(
    new Set(targets.flatMap((m) => [m.home_team!.id, m.away_team!.id])),
  );
  const squadsMap = await getWCSquads(supabase, uniqueTeamIds, 10);

  let okCount = 0;
  let errors = 0;
  for (const m of targets) {
    try {
      const { content, model } = await generateWCKnockoutPrediction({
        stage: m.stage ?? 'KO',
        home: {
          team_id: m.home_team!.id,
          name: m.home_team!.name,
          country: m.home_team!.country,
          squad: formatSquadForPrompt(squadsMap.get(m.home_team!.id) ?? []),
        },
        away: {
          team_id: m.away_team!.id,
          name: m.away_team!.name,
          country: m.away_team!.country,
          squad: formatSquadForPrompt(squadsMap.get(m.away_team!.id) ?? []),
        },
      });
      const { error } = await supabase
        .from('wc_knockout_predictions')
        .upsert(
          {
            match_id: m.id,
            predicted_winner_team_id: content.winner_team_id,
            predicted_score_home: content.score_home,
            predicted_score_away: content.score_away,
            confidence: content.confidence,
            reasoning: content.reasoning,
            ai_model: model,
            generated_at: new Date().toISOString(),
          },
          { onConflict: 'match_id' },
        );
      if (error) throw error;
      okCount++;
    } catch (e) {
      errors++;
      console.error(`[wc] knockout match ${m.id} failed:`, e);
    }
  }

  revalidatePath('/coupe-du-monde-2026');
  revalidatePath('/admin/cdm');
  return { ok: true, ok_count: okCount, errors };
}
