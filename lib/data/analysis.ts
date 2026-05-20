import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type {
  PostMatchAnalysis,
  PreMatchAnalysis,
} from '@/lib/openai/types.ts';

type Supa = SupabaseClient<Database>;

export type AnalysisType = 'pre_match' | 'post_match';

export type AnalysisRow = {
  id: number;
  match_id: number;
  type: AnalysisType;
  content_json: PreMatchAnalysis | PostMatchAnalysis;
  ai_model: string;
  generated_at: string;
};

/**
 * Upsert d'une analyse IA pour un match donné.
 * Unique sur (match_id, type) — une seule analyse pré-match et une seule
 * post-match par match (jamais régénérées, comme stipulé dans CLAUDE.md).
 */
export async function upsertAnalysis(
  supabase: Supa,
  matchId: number,
  type: AnalysisType,
  content: PreMatchAnalysis | PostMatchAnalysis,
  aiModel: string,
): Promise<void> {
  const { error } = await supabase.from('match_analyses').upsert(
    {
      match_id: matchId,
      type,
      content_json: content,
      ai_model: aiModel,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'match_id,type' },
  );
  if (error) throw new Error(`upsertAnalysis: ${error.message}`);
}

export async function getAnalysis(
  supabase: Supa,
  matchId: number,
  type: AnalysisType,
): Promise<AnalysisRow | null> {
  const { data, error } = await supabase
    .from('match_analyses')
    .select('id, match_id, type, content_json, ai_model, generated_at')
    .eq('match_id', matchId)
    .eq('type', type)
    .maybeSingle();
  if (error) {
    console.error('[data/analysis] getAnalysis', error);
    return null;
  }
  return (data as unknown as AnalysisRow | null) ?? null;
}
