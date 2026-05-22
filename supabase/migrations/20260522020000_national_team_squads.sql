-- ============================================================================
-- Sélections nationales — squad par équipe (CDM 2026 + autres)
-- ============================================================================
-- Permet de mémoriser, pour chaque équipe nationale, la liste des joueurs
-- convoqués/sélectionnés. Source primaire : API-Football /players/squads.
-- Le champ source permet de distinguer "dernière convocation AF" vs "liste
-- officielle CDM" plus tard.
-- ============================================================================

create table if not exists public.national_team_squads (
  team_id bigint not null references public.teams(id) on delete cascade,
  player_id bigint not null references public.players(id) on delete cascade,
  position text,
  shirt_number int,
  source text not null default 'api_football_squads',
  last_updated_at timestamptz not null default now(),
  primary key (team_id, player_id)
);

create index if not exists national_team_squads_team_idx
  on public.national_team_squads(team_id);

alter table public.national_team_squads enable row level security;

drop policy if exists "public reads national squads" on public.national_team_squads;
create policy "public reads national squads"
  on public.national_team_squads for select using (true);
