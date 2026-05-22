-- ============================================================================
-- Sélectionneurs / entraîneurs principaux par équipe
-- ============================================================================
-- Cache le résultat de AF /coachs?team=X. Permet d'éviter une requête à
-- chaque génération de prono CDM. Refresh manuel (ou cron léger plus tard).
-- ============================================================================

create table if not exists public.team_coaches (
  team_id bigint primary key references public.teams(id) on delete cascade,
  af_coach_id int,
  name text not null,
  nationality text,
  photo_url text,
  in_charge_since date,
  last_updated_at timestamptz not null default now()
);

alter table public.team_coaches enable row level security;

drop policy if exists "public reads team coaches" on public.team_coaches;
create policy "public reads team coaches"
  on public.team_coaches for select using (true);
