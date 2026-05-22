-- ============================================================================
-- Mini-clips vidéo (YouTube) attachés aux entités
-- ============================================================================
-- L'admin colle une URL YouTube et l'associe à un match, un joueur, un club
-- ou un article. Le clip s'affiche dans la section "Vidéos" de la page
-- correspondante. youtube_id = l'identifiant extrait de l'URL.
-- ============================================================================

create table if not exists public.video_clips (
  id bigserial primary key,
  entity_type text not null
    check (entity_type in ('team', 'player', 'match', 'news')),
  entity_id bigint not null,
  youtube_id text not null,
  title text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists video_clips_entity_idx
  on public.video_clips(entity_type, entity_id, sort_order);

alter table public.video_clips enable row level security;

drop policy if exists "public reads video clips" on public.video_clips;
create policy "public reads video clips"
  on public.video_clips for select using (true);
