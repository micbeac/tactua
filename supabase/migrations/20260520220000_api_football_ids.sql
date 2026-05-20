-- ============================================================================
-- Tactuo — Colonnes api_football_id pour bridge Football-Data ↔ API-Football
-- ============================================================================
-- Nos IDs primaires viennent de Football-Data (compétitions, équipes,
-- joueurs). Pour utiliser API-Football proprement (stats détaillées, lineups,
-- carrière), on stocke leur ID en colonne secondaire. Backfill par scripts
-- de matching, puis utilisé par les mappers et enrichissements.
-- ============================================================================

alter table public.competitions
  add column if not exists api_football_league_id int;

alter table public.teams
  add column if not exists api_football_id int;

alter table public.players
  add column if not exists api_football_id int;

-- Index uniques pour permettre les lookups rapides et garantir 1 mapping unique.
create unique index if not exists teams_api_football_id_uidx
  on public.teams(api_football_id)
  where api_football_id is not null;

create unique index if not exists players_api_football_id_uidx
  on public.players(api_football_id)
  where api_football_id is not null;
