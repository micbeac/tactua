-- ============================================================================
-- Tactuo — Enrichir la table players avec photo et numéro de maillot
-- ============================================================================
-- Sources : API-Football (squad + lineups). Stockage opportuniste : on remplit
-- ces champs quand on les a, sinon null. La photo est servie depuis le CDN
-- d'API-Football (https://media.api-sports.io/football/players/{id}.png).
-- ============================================================================

alter table public.players add column if not exists photo_url text;
alter table public.players add column if not exists shirt_number int;
