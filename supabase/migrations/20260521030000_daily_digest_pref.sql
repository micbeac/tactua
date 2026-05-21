-- ============================================================================
-- Tactuo — Préférences notifications email
-- ============================================================================
-- Ajout d'une colonne sur profiles pour gérer l'opt-in au digest matinal.
-- Par défaut activé pour les nouveaux comptes — les emails étant centraux
-- dans la valeur perçue de Tactuo pour la rétention CDM.
-- ============================================================================

alter table public.profiles
  add column if not exists daily_digest_enabled boolean not null default true;

-- Trace de la dernière envoi pour éviter les doublons en cas de re-run cron.
alter table public.profiles
  add column if not exists daily_digest_sent_at timestamptz;
