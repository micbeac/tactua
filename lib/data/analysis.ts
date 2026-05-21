import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type {
  DeepPreMatchAnalysis,
  MatchRichData,
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
  if (!data) return null;
  const row = data as unknown as AnalysisRow;

  // Re-résout db_player_id pour les top_players (cas où l'analyse a été
  // générée avant le backfill complet — db_player_id était null pour les
  // joueurs alors non-mappés). Garantit que les popups joueurs ouvrent
  // toujours la fiche joueur si elle existe maintenant en DB.
  if (type === 'pre_match') {
    await resolveTopPlayersDbIds(supabase, row);
  }

  return row;
}

async function resolveTopPlayersDbIds(
  supabase: Supa,
  row: AnalysisRow,
): Promise<void> {
  const content = row.content_json as PreMatchAnalysis | DeepPreMatchAnalysis;
  const rich = (content as DeepPreMatchAnalysis).rich_data as
    | MatchRichData
    | undefined;
  if (!rich?.top_players || rich.top_players.length === 0) return;

  // Récupère tous les af_player_id n'ayant pas encore de db_player_id résolu
  const afIdsToResolve = rich.top_players
    .filter((p) => p.db_player_id == null && p.af_player_id != null)
    .map((p) => p.af_player_id);
  if (afIdsToResolve.length === 0) return;

  const { data: dbPlayers } = await supabase
    .from('players')
    .select('id, api_football_id')
    .in('api_football_id', afIdsToResolve);
  if (!dbPlayers || dbPlayers.length === 0) return;

  const map = new Map<number, number>();
  for (const p of dbPlayers as Array<{
    id: number;
    api_football_id: number;
  }>) {
    map.set(p.api_football_id, p.id);
  }

  // Mute le contenu en place (le caller utilise cette ref)
  for (const player of rich.top_players) {
    if (player.db_player_id == null && player.af_player_id != null) {
      const dbId = map.get(player.af_player_id);
      if (dbId != null) player.db_player_id = dbId;
    }
  }
}
