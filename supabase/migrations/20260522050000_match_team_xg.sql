-- ============================================================================
-- xG (expected goals) par équipe et par match
-- ============================================================================
-- API-Football fournit expected_goals + goals_prevented dans
-- /fixtures/statistics. On les stocke dans match_team_stats.
--   - expected_goals  : xG de l'équipe sur le match
--   - goals_prevented : buts évités par le gardien (perf défensive vs xG subi)
-- ============================================================================

alter table public.match_team_stats
  add column if not exists expected_goals numeric(5, 2);

alter table public.match_team_stats
  add column if not exists goals_prevented numeric(5, 2);
