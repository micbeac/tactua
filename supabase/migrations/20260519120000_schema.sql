-- ============================================================================
-- Tactua — Schéma initial
-- ============================================================================
-- 13 tables : 1 user (profiles) + 10 données football + 2 utilisateur (favorites, notif).
-- Les IDs des entités football (competitions, teams, players, matches) viennent
-- directement de Football-Data.org → bigint, pas de séquence.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper : trigger générique pour mettre à jour updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 1. profiles (extension de auth.users)
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 2. competitions
-- ============================================================================
create table public.competitions (
  id bigint primary key,
  name text not null,
  code text,
  country text,
  current_season text,
  last_updated_at timestamptz not null default now()
);

-- ============================================================================
-- 3. teams
-- ============================================================================
create table public.teams (
  id bigint primary key,
  name text not null,
  short_name text,
  tla text,
  country text,
  logo_url text,
  founded int,
  venue text,
  last_updated_at timestamptz not null default now()
);

create index teams_country_idx on public.teams(country);

-- ============================================================================
-- 4. players
-- ============================================================================
create table public.players (
  id bigint primary key,
  name text not null,
  first_name text,
  last_name text,
  position text,
  nationality text,
  date_of_birth date,
  current_team_id bigint references public.teams(id) on delete set null,
  last_updated_at timestamptz not null default now()
);

create index players_current_team_id_idx on public.players(current_team_id);

-- ============================================================================
-- 5. matches
-- ============================================================================
create table public.matches (
  id bigint primary key,
  competition_id bigint not null references public.competitions(id) on delete cascade,
  home_team_id bigint not null references public.teams(id) on delete cascade,
  away_team_id bigint not null references public.teams(id) on delete cascade,
  kickoff_at timestamptz not null,
  venue text,
  referee text,
  status text not null check (status in ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
  score_home int,
  score_away int,
  half_time_home int,
  half_time_away int,
  matchday int,
  stage text,
  last_updated_at timestamptz not null default now()
);

create index matches_competition_id_idx on public.matches(competition_id);
create index matches_kickoff_at_idx on public.matches(kickoff_at);
create index matches_status_idx on public.matches(status);
create index matches_home_team_id_idx on public.matches(home_team_id);
create index matches_away_team_id_idx on public.matches(away_team_id);

-- ============================================================================
-- 6. match_lineups
-- ============================================================================
-- Un joueur peut apparaître 2 fois sur un match : une fois en compo probable
-- (is_confirmed = false), une fois en compo officielle (is_confirmed = true).
create table public.match_lineups (
  id bigserial primary key,
  match_id bigint not null references public.matches(id) on delete cascade,
  team_id bigint not null references public.teams(id) on delete cascade,
  player_id bigint not null references public.players(id) on delete cascade,
  position text,
  shirt_number int,
  is_starter boolean not null default false,
  is_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, team_id, player_id, is_confirmed)
);

create index match_lineups_match_id_idx on public.match_lineups(match_id);
create index match_lineups_player_id_idx on public.match_lineups(player_id);

-- ============================================================================
-- 7. match_team_stats
-- ============================================================================
create table public.match_team_stats (
  match_id bigint not null references public.matches(id) on delete cascade,
  team_id bigint not null references public.teams(id) on delete cascade,
  possession numeric(5, 2),
  shots int,
  shots_on_target int,
  corners int,
  fouls int,
  yellow_cards int,
  red_cards int,
  offsides int,
  primary key (match_id, team_id)
);

-- ============================================================================
-- 8. match_player_stats
-- ============================================================================
create table public.match_player_stats (
  match_id bigint not null references public.matches(id) on delete cascade,
  player_id bigint not null references public.players(id) on delete cascade,
  minutes_played int,
  goals int default 0,
  assists int default 0,
  shots int,
  passes int,
  key_passes int,
  yellow_card boolean default false,
  red_card boolean default false,
  rating numeric(3, 1),
  primary key (match_id, player_id)
);

-- ============================================================================
-- 9. team_season_stats
-- ============================================================================
create table public.team_season_stats (
  team_id bigint not null references public.teams(id) on delete cascade,
  competition_id bigint not null references public.competitions(id) on delete cascade,
  season text not null,
  played int default 0,
  wins int default 0,
  draws int default 0,
  losses int default 0,
  goals_for int default 0,
  goals_against int default 0,
  goal_difference int default 0,
  points int default 0,
  position int,
  form_last_5 text[],
  last_updated_at timestamptz not null default now(),
  primary key (team_id, competition_id, season)
);

create index team_season_stats_competition_id_season_idx
  on public.team_season_stats(competition_id, season);

-- ============================================================================
-- 10. player_season_stats
-- ============================================================================
create table public.player_season_stats (
  player_id bigint not null references public.players(id) on delete cascade,
  competition_id bigint not null references public.competitions(id) on delete cascade,
  season text not null,
  appearances int default 0,
  minutes int default 0,
  goals int default 0,
  assists int default 0,
  yellow_cards int default 0,
  red_cards int default 0,
  last_updated_at timestamptz not null default now(),
  primary key (player_id, competition_id, season)
);

-- ============================================================================
-- 11. match_analyses (IA pré/post-match)
-- ============================================================================
create table public.match_analyses (
  id bigserial primary key,
  match_id bigint not null references public.matches(id) on delete cascade,
  type text not null check (type in ('pre_match', 'post_match')),
  content_json jsonb not null,
  ai_model text not null,
  generated_at timestamptz not null default now(),
  unique (match_id, type)
);

create index match_analyses_match_id_idx on public.match_analyses(match_id);

-- ============================================================================
-- 12. user_favorites
-- ============================================================================
create table public.user_favorites (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('team', 'player', 'match', 'competition')),
  entity_id bigint not null,
  created_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);

create index user_favorites_user_id_idx on public.user_favorites(user_id);

-- ============================================================================
-- 13. notification_log
-- ============================================================================
create table public.notification_log (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('lineup_confirmed', 'kickoff', 'final_score')),
  match_id bigint not null references public.matches(id) on delete cascade,
  sent_at timestamptz not null default now(),
  email_status text not null default 'sent' check (email_status in ('sent', 'failed', 'bounced')),
  unique (user_id, event_type, match_id)
);

create index notification_log_user_id_idx on public.notification_log(user_id);
create index notification_log_match_id_idx on public.notification_log(match_id);
