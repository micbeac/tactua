-- ============================================================================
-- Tactuo — Table wc_news : fil d'actualité dédié à la Coupe du Monde 2026
-- ============================================================================
-- Séparée de team_narratives (news clubs). Spécificités :
--   - team_id NULLABLE : une news peut concerner une sélection précise OU
--     être transversale au tournoi (category = 'tournoi').
--   - status : les articles arrivent en 'draft' (scraping) ; l'admin les
--     relit/édite puis les passe en 'published'. Seuls les 'published' sont
--     visibles publiquement (RLS).
--   - video_youtube_id : vidéo YouTube optionnelle attachée à l'article.
-- ============================================================================

create table if not exists public.wc_news (
  id bigserial primary key,
  team_id int references public.teams(id) on delete set null,
  category text not null default 'selection'
    check (category in ('selection', 'tournoi')),
  title text not null,
  slug text unique,
  source_url text,
  source_name text,
  snippet text,
  scraped_at timestamptz not null default now(),
  published_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  ai_summary text,
  ai_content text,
  ai_perspective text,
  ai_generated_at timestamptz,
  ai_model text,
  video_youtube_id text,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  -- Hash naturel anti-doublon sur l'article source
  url_hash text generated always as (md5(coalesce(source_url, title))) stored,
  unique (url_hash)
);

create index if not exists wc_news_status_idx
  on public.wc_news(status, published_at desc nulls last);
create index if not exists wc_news_team_idx
  on public.wc_news(team_id);
create index if not exists wc_news_scraped_idx
  on public.wc_news(scraped_at desc);

-- RLS : lecture publique limitée aux articles publiés ; écriture service role.
alter table public.wc_news enable row level security;

drop policy if exists "wc_news published readable by everyone" on public.wc_news;
create policy "wc_news published readable by everyone"
  on public.wc_news
  for select
  using (status = 'published');
