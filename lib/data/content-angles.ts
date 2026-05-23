// Data layer pour content_angles (admin /admin/contenu).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type ContentAngleVisual = {
  outil: 'leonardo' | 'chatgpt';
  moment_video: string;
  prompt: string;
  specs: string;
};

export type ContentAngleSource = {
  type: string;
  moment_video: string;
  sujet: string;
  lien_recherche: string;
  instructions: string;
};

export type ContentAngleRow = {
  id: number;
  created_at: string;
  match_id: number;
  generation_phase: string;
  format: string | null;
  hook: string | null;
  title: string | null;
  data_points: string[] | null;
  narrative: string | null;
  joueur_principal: string | null;
  club_principal: string | null;
  championnat: string | null;
  score_viralite: number | null;
  cta_tactuo: string | null;
  urgence: string | null;
  script_timecode: string | null;
  prompt_elevenlabs: string | null;
  prompts_visuels_ia: ContentAngleVisual[] | null;
  sources_visuels_a_chercher: ContentAngleSource[] | null;
  instructions_capcut: string | null;
  caption_tiktok: string | null;
  hashtags: string | null;
  status: string;
  validated_at: string | null;
  produced_at: string | null;
  published_at: string | null;
  rejected_reason: string | null;
  url_tiktok: string | null;
  url_instagram: string | null;
  url_youtube: string | null;
  vues_24h: number | null;
  vues_7j: number | null;
  ai_model: string | null;
  match: {
    id: number;
    kickoff_at: string;
    home_team: { name: string } | null;
    away_team: { name: string } | null;
  } | null;
};

const SELECT = `
  id, created_at, match_id, generation_phase, format, hook, title,
  data_points, narrative, joueur_principal, club_principal, championnat,
  score_viralite, cta_tactuo, urgence, script_timecode, prompt_elevenlabs,
  prompts_visuels_ia, sources_visuels_a_chercher, instructions_capcut,
  caption_tiktok, hashtags, status, validated_at, produced_at, published_at,
  rejected_reason, url_tiktok, url_instagram, url_youtube, vues_24h, vues_7j,
  ai_model,
  match:matches!content_angles_match_id_fkey(
    id, kickoff_at,
    home_team:teams!matches_home_team_id_fkey(name),
    away_team:teams!matches_away_team_id_fkey(name)
  )
`;

/** Tous les angles, ordonnés par score puis date. */
export async function getAllContentAngles(
  supabase: Supa,
): Promise<ContentAngleRow[]> {
  const { data } = await supabase
    .from('content_angles')
    .select(SELECT)
    .order('score_viralite', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500);
  return (data ?? []) as unknown as ContentAngleRow[];
}
