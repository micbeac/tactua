-- ============================================================================
-- Tactuo — Compétition « Matchs amicaux internationaux »
-- ============================================================================
-- Permet d'importer les amicaux de préparation à la CDM 2026 (joués entre les
-- sélections nationales) via API-Football league_id = 10. Compétition séparée
-- pour que :
--   - les amicaux soient identifiables sans contaminer les compétitions
--     officielles ;
--   - la page CDM puisse afficher une section dédiée « Matchs de préparation » ;
--   - le générateur d'angles + l'analyse pré-match les traitent normalement.
-- ============================================================================

insert into public.competitions (
  id, code, name, country, current_season, api_football_league_id
)
values (
  9990, 'IFR', 'Matchs amicaux internationaux', 'International',
  '2026', 10
)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  country = excluded.country,
  current_season = excluded.current_season,
  api_football_league_id = excluded.api_football_league_id;
