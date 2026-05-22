// Mini-clips vidéo YouTube attachés aux entités (match, joueur, club, article).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

export type VideoClipEntity = 'team' | 'player' | 'match' | 'news';

export type VideoClip = {
  id: number;
  youtube_id: string;
  title: string;
};

/**
 * Extrait l'identifiant vidéo d'une URL YouTube, quelle que soit la forme :
 * watch?v=, youtu.be/, /shorts/, /embed/. Renvoie null si non reconnu.
 */
export function extractYoutubeId(input: string): string | null {
  const url = input.trim();
  // Déjà un ID brut (11 caractères)
  if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/shorts\/([A-Za-z0-9_-]{11})/,
    /\/embed\/([A-Za-z0-9_-]{11})/,
    /\/live\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/** Miniature YouTube (qualité hqdefault, toujours disponible). */
export function youtubeThumbnail(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}

/**
 * Clips d'une entité, triés par sort_order puis date.
 */
export async function getVideoClips(
  supabase: Supa,
  entityType: VideoClipEntity,
  entityId: number,
): Promise<VideoClip[]> {
  const { data, error } = await supabase
    .from('video_clips')
    .select('id, youtube_id, title')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[data/video-clips]', error);
    return [];
  }
  return (data ?? []) as VideoClip[];
}
