-- ============================================================================
-- CDM 2026 — Mapping équipe → groupe + prédictions IA
-- ============================================================================
-- CDM 2026 : 48 équipes, 12 groupes (A à L) de 4 équipes.
-- Top 2 + 8 meilleurs 3e → 1/16e → 1/8e → quarts → demis → finale (64 matchs).
-- ============================================================================

-- 1. Mapping équipe → groupe
create table if not exists public.wc_group_assignments (
  id bigserial primary key,
  team_id int not null references public.teams(id) on delete cascade,
  group_letter text not null check (group_letter ~ '^[A-L]$'),
  unique (team_id)
);
create index if not exists wc_group_assignments_letter_idx
  on public.wc_group_assignments(group_letter, team_id);

alter table public.wc_group_assignments enable row level security;
drop policy if exists "public reads wc groups" on public.wc_group_assignments;
create policy "public reads wc groups"
  on public.wc_group_assignments for select using (true);

-- 2. Prédictions IA par groupe : qui finira 1er, 2e, 3e, 4e + raison
create table if not exists public.wc_group_predictions (
  group_letter text primary key check (group_letter ~ '^[A-L]$'),
  content_json jsonb not null,            -- { ranking: [...], reasoning: "..." }
  ai_model text,
  generated_at timestamptz not null default now()
);

alter table public.wc_group_predictions enable row level security;
drop policy if exists "public reads wc predictions" on public.wc_group_predictions;
create policy "public reads wc predictions"
  on public.wc_group_predictions for select using (true);

-- 3. Prédictions IA matchs phase finale (knockout)
-- Pour chaque match futur de la phase finale, l'IA prédit le vainqueur.
-- match_id pointe vers matches.id (notre id Tactuo).
create table if not exists public.wc_knockout_predictions (
  match_id int primary key references public.matches(id) on delete cascade,
  predicted_winner_team_id int references public.teams(id) on delete set null,
  predicted_score_home int,
  predicted_score_away int,
  confidence text check (confidence in ('low', 'medium', 'high')),
  reasoning text,
  ai_model text,
  generated_at timestamptz not null default now()
);

alter table public.wc_knockout_predictions enable row level security;
drop policy if exists "public reads wc knockout" on public.wc_knockout_predictions;
create policy "public reads wc knockout"
  on public.wc_knockout_predictions for select using (true);
