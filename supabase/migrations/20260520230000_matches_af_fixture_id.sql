-- ============================================================================
-- Tactuo — Colonne api_football_fixture_id sur matches
-- ============================================================================
-- Pré-mapping FD match_id ↔ API-Football fixture_id. Évite à l'enrichissement
-- de chercher le fixture par date+nom d'équipe (flaky quand plusieurs matchs
-- le même jour comme pendant la WC).
-- ============================================================================

alter table public.matches
  add column if not exists api_football_fixture_id int;

create unique index if not exists matches_api_football_fixture_id_uidx
  on public.matches(api_football_fixture_id)
  where api_football_fixture_id is not null;
