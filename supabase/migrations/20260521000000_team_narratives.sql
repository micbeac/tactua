-- ============================================================================
-- Tactuo — Table team_narratives : actualité foot par équipe (sourcing Apify)
-- ============================================================================
-- Stocke les news/articles récents par équipe. Alimenté par un cron hebdo qui
-- appelle l'actor Apify rag-web-browser (recherche Google + extraction markdown).
--
-- Utilisé pour :
--   1. Enrichir le prompt IA pré-match avec des narratifs récents (transferts,
--      blessures, déclarations coach) — différenciation vs ChatGPT brut.
--   2. Afficher une section "Actu récente" sur la fiche équipe.
-- ============================================================================

create table if not exists public.team_narratives (
  id bigserial primary key,
  team_id int not null references public.teams(id) on delete cascade,
  title text not null,
  url text,
  snippet text,
  published_at timestamptz,
  scraped_at timestamptz not null default now(),
  source text not null,  -- 'apify-rag', 'apify-transfermarkt', etc.
  -- Hash naturel pour éviter les doublons sur le même article scrapé plusieurs fois
  url_hash text generated always as (md5(coalesce(url, title))) stored,
  unique (team_id, url_hash)
);

create index if not exists team_narratives_team_recent_idx
  on public.team_narratives(team_id, scraped_at desc);

-- RLS : lecture publique (comme les autres données foot), écriture service role
alter table public.team_narratives enable row level security;

drop policy if exists "team_narratives readable by everyone" on public.team_narratives;
create policy "team_narratives readable by everyone"
  on public.team_narratives
  for select
  using (true);
