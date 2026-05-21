-- Live match support : events timeline + minute en cours
-- Permet l'affichage en direct (buts, cartons, subs, VAR) sur la fiche match.

-- 1. Minute live sur matches
alter table public.matches
  add column if not exists live_minute int,
  add column if not exists live_updated_at timestamptz;

-- 2. Table events
create table if not exists public.match_events (
  id bigserial primary key,
  match_id int not null references public.matches(id) on delete cascade,
  team_id int references public.teams(id) on delete set null,
  player_id int references public.players(id) on delete set null,
  assist_player_id int references public.players(id) on delete set null,
  minute int,                          -- minute principale (90+3 stocké comme 93)
  extra_minute int,                    -- temps additionnel séparé
  type text not null,                  -- 'goal', 'card', 'subst', 'var'
  detail text,                         -- 'Normal Goal', 'Yellow Card', 'Substitution 1', etc.
  comments text,                       -- ex: 'Goal cancelled - Offside'
  created_at timestamptz not null default now(),
  -- Unicité : un event est identifié par (match, minute, type, joueur, équipe)
  -- pour éviter les doublons lors des re-fetch
  unique (match_id, minute, type, player_id, team_id, detail)
);

create index if not exists match_events_match_idx
  on public.match_events(match_id, minute);

-- RLS : lecture publique (comme matches), pas d'écriture user
alter table public.match_events enable row level security;
drop policy if exists "public reads events" on public.match_events;
create policy "public reads events"
  on public.match_events for select using (true);
