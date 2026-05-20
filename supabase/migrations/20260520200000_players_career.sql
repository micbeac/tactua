-- ============================================================================
-- Tactuo — Enrichir players avec carrière (transferts + bio physique)
-- ============================================================================
-- Sources : API-Football /transfers + /players/profiles.
-- ============================================================================

alter table public.players add column if not exists transfers_json jsonb;
alter table public.players add column if not exists height int;
alter table public.players add column if not exists weight int;
alter table public.players add column if not exists birth_place text;
alter table public.players add column if not exists birth_country text;
