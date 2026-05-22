'use server';

import { revalidatePath } from 'next/cache';
import { getAdminUser } from '@/lib/data/admin';
import { extractYoutubeId, type VideoClipEntity } from '@/lib/data/video-clips';
import { createAdminClient } from '@/lib/supabase/admin';

type Result = { ok: true } | { ok: false; message: string };

const ENTITY_TYPES: VideoClipEntity[] = ['team', 'player', 'match', 'news'];

export async function addVideoClip(input: {
  entity_type: string;
  entity_id: number;
  youtube_url: string;
  title: string;
}): Promise<Result> {
  const admin = await getAdminUser();
  if (!admin || !admin.is_admin) return { ok: false, message: 'Accès refusé' };

  if (!ENTITY_TYPES.includes(input.entity_type as VideoClipEntity)) {
    return { ok: false, message: "Type d'entité invalide" };
  }
  if (!Number.isFinite(input.entity_id) || input.entity_id <= 0) {
    return { ok: false, message: 'Aucune entité sélectionnée' };
  }
  const youtubeId = extractYoutubeId(input.youtube_url);
  if (!youtubeId) {
    return { ok: false, message: 'URL YouTube non reconnue' };
  }
  if (!input.title.trim()) {
    return { ok: false, message: 'Titre requis' };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('video_clips').insert({
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    youtube_id: youtubeId,
    title: input.title.trim(),
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/videos');
  return { ok: true };
}

export async function deleteVideoClip(id: number): Promise<Result> {
  const admin = await getAdminUser();
  if (!admin || !admin.is_admin) return { ok: false, message: 'Accès refusé' };

  const supabase = createAdminClient();
  const { error } = await supabase.from('video_clips').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/videos');
  return { ok: true };
}

export type EntityResult = { id: number; label: string };

/** Recherche d'entités pour le sélecteur du formulaire admin. */
export async function searchEntities(
  type: string,
  query: string,
): Promise<EntityResult[]> {
  const admin = await getAdminUser();
  if (!admin || !admin.is_admin) return [];

  // Nettoie les caractères qui casseraient le filtre ilike / or
  const q = query.trim().replace(/[%,()]/g, ' ').trim();
  if (q.length < 2) return [];

  const supabase = createAdminClient();

  if (type === 'team') {
    const { data } = await supabase
      .from('teams')
      .select('id, name')
      .ilike('name', `%${q}%`)
      .limit(12);
    return ((data ?? []) as Array<{ id: number; name: string }>).map((t) => ({
      id: t.id,
      label: t.name,
    }));
  }

  if (type === 'player') {
    const { data } = await supabase
      .from('players')
      .select('id, name')
      .ilike('name', `%${q}%`)
      .limit(12);
    return ((data ?? []) as Array<{ id: number; name: string }>).map((p) => ({
      id: p.id,
      label: p.name,
    }));
  }

  if (type === 'news') {
    const { data } = await supabase
      .from('team_narratives')
      .select('id, title')
      .ilike('title', `%${q}%`)
      .order('scraped_at', { ascending: false })
      .limit(12);
    return ((data ?? []) as Array<{ id: number; title: string }>).map((n) => ({
      id: n.id,
      label: n.title,
    }));
  }

  // match : recherche via le nom d'une des deux équipes
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .ilike('name', `%${q}%`)
    .limit(6);
  const teamIds = ((teams ?? []) as Array<{ id: number }>).map((t) => t.id);
  if (teamIds.length === 0) return [];

  const { data: matches } = await supabase
    .from('matches')
    .select(
      `id, kickoff_at,
       home_team:teams!matches_home_team_id_fkey(name),
       away_team:teams!matches_away_team_id_fkey(name)`,
    )
    .or(
      `home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`,
    )
    .order('kickoff_at', { ascending: false })
    .limit(15);

  type MatchRow = {
    id: number;
    kickoff_at: string;
    home_team: { name: string } | null;
    away_team: { name: string } | null;
  };
  return ((matches ?? []) as unknown as MatchRow[]).map((m) => ({
    id: m.id,
    label: `${m.home_team?.name ?? '?'} - ${m.away_team?.name ?? '?'} · ${m.kickoff_at.slice(0, 10)}`,
  }));
}
