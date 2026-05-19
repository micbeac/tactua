-- ============================================================================
-- Tactua — Row Level Security
-- ============================================================================
-- Stratégie :
--   - Tables football (lecture publique) : SELECT autorisé à tous, écriture
--     uniquement via service_role (les cron jobs). RLS activée sans policy
--     d'écriture = écriture refusée pour anon/authenticated. service_role
--     bypasse RLS par défaut.
--   - Tables utilisateur (profiles, user_favorites, notification_log) :
--     accès strict au propriétaire (auth.uid() = user_id).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tables football — lecture publique uniquement
-- ----------------------------------------------------------------------------
alter table public.competitions enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.match_lineups enable row level security;
alter table public.match_team_stats enable row level security;
alter table public.match_player_stats enable row level security;
alter table public.team_season_stats enable row level security;
alter table public.player_season_stats enable row level security;
alter table public.match_analyses enable row level security;

create policy "Public read competitions"
  on public.competitions for select to anon, authenticated using (true);

create policy "Public read teams"
  on public.teams for select to anon, authenticated using (true);

create policy "Public read players"
  on public.players for select to anon, authenticated using (true);

create policy "Public read matches"
  on public.matches for select to anon, authenticated using (true);

create policy "Public read match_lineups"
  on public.match_lineups for select to anon, authenticated using (true);

create policy "Public read match_team_stats"
  on public.match_team_stats for select to anon, authenticated using (true);

create policy "Public read match_player_stats"
  on public.match_player_stats for select to anon, authenticated using (true);

create policy "Public read team_season_stats"
  on public.team_season_stats for select to anon, authenticated using (true);

create policy "Public read player_season_stats"
  on public.player_season_stats for select to anon, authenticated using (true);

create policy "Public read match_analyses"
  on public.match_analyses for select to anon, authenticated using (true);

-- ----------------------------------------------------------------------------
-- 2. profiles — chaque user voit/modifie seulement sa propre ligne
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "Users read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Pas de INSERT policy : la ligne est créée automatiquement par le trigger
-- on_auth_user_created (qui tourne en SECURITY DEFINER, donc bypass RLS).
-- Pas de DELETE policy : la suppression cascade via auth.users.

-- ----------------------------------------------------------------------------
-- 3. user_favorites — CRUD restreint au propriétaire
-- ----------------------------------------------------------------------------
alter table public.user_favorites enable row level security;

create policy "Users read own favorites"
  on public.user_favorites for select to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own favorites"
  on public.user_favorites for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users delete own favorites"
  on public.user_favorites for delete to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. notification_log — lecture seule pour le propriétaire
-- ----------------------------------------------------------------------------
alter table public.notification_log enable row level security;

create policy "Users read own notifications"
  on public.notification_log for select to authenticated
  using (auth.uid() = user_id);

-- L'écriture est faite par le worker cron via service_role (bypass RLS).
