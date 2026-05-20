-- ============================================================================
-- Tactuo — Ajout de la Jupiler Pro League (1re division belge)
-- ============================================================================
-- Football-Data.org ne couvre pas la JPL dans le free tier. On l'ajoute donc
-- via API-Football uniquement. ID interne = 9001 (hors plage FD).
--
-- Cette migration crée juste la ligne competitions. Les teams + matches +
-- standings seront importés par le script scripts/import-jupiler-pro-league.ts.
-- ============================================================================

insert into public.competitions (id, code, name, country, current_season, api_football_league_id)
values (
  9001,
  'BJL',
  'Jupiler Pro League',
  'Belgium',
  '2025',
  144
)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  country = excluded.country,
  current_season = excluded.current_season,
  api_football_league_id = excluded.api_football_league_id;
