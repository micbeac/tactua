-- ============================================================================
-- Stats en sélection nationale par joueur (sélections + buts + passes)
-- ============================================================================
-- Agrégat des matchs internationaux sur les 2 dernières années calendaires
-- (toutes compétitions : qualifs, Nations League, amicaux, CDM...).
-- Alimenté par scripts/backfill-national-team-squads.ts.
-- ============================================================================

alter table public.national_team_squads
  add column if not exists intl_caps int not null default 0;

alter table public.national_team_squads
  add column if not exists intl_goals int not null default 0;

alter table public.national_team_squads
  add column if not exists intl_assists int not null default 0;
