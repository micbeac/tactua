-- ============================================================================
-- Tactuo — Tracking des interactions user × match analysis
-- ============================================================================
-- Pour l'historique perso ("relire mes analyses") + futur score de précision
-- + analytics produit (qui s'intéresse à quel club).
-- ============================================================================

create table if not exists public.user_match_analysis_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id int not null references public.matches(id) on delete cascade,
  analysis_type text not null check (analysis_type in ('pre_match', 'post_match')),
  action text not null check (action in ('generated', 'refreshed', 'viewed')),
  at timestamptz not null default now()
);

create index if not exists user_match_events_user_idx
  on public.user_match_analysis_events(user_id, at desc);

create index if not exists user_match_events_match_idx
  on public.user_match_analysis_events(match_id, user_id);

alter table public.user_match_analysis_events enable row level security;

-- L'utilisateur peut lire ses propres events
drop policy if exists "own events readable" on public.user_match_analysis_events;
create policy "own events readable"
  on public.user_match_analysis_events
  for select
  using (auth.uid() = user_id);

-- Écriture via service role uniquement (depuis les endpoints serveur)
