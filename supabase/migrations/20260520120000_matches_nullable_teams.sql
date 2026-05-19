-- ============================================================================
-- Tactua — Permettre les équipes TBD sur les matchs (knockouts CDM, etc.)
-- ============================================================================
-- Football-Data renvoie homeTeam.id = null pour les matchs dont les équipes
-- ne sont pas encore déterminées (ex : "1er groupe A vs 2e groupe B" en CDM).
-- On rend les FK nullables ; elles seront remplies par refresh-matchday quand
-- les équipes sont connues.
-- ============================================================================

alter table public.matches alter column home_team_id drop not null;
alter table public.matches alter column away_team_id drop not null;
