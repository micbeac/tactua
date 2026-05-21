-- Enrichissement team_narratives : contenu IA généré pour pages internes SEO/GEO.
-- Chaque news devient une page indexable /news/[slug] avec résumé, contenu long,
-- mise en perspective éditoriale et liens vers le contexte Tactuo (équipe, joueurs).

alter table public.team_narratives
  add column if not exists slug text,
  add column if not exists ai_summary text,        -- 1-2 phrases TLDR pour cards
  add column if not exists ai_content text,        -- 400-500 mots Markdown
  add column if not exists ai_perspective text,    -- 2-3 phrases "pourquoi ça compte"
  add column if not exists ai_generated_at timestamptz,
  add column if not exists ai_model text;

create unique index if not exists team_narratives_slug_unique
  on public.team_narratives(slug)
  where slug is not null;

create index if not exists team_narratives_ai_team_idx
  on public.team_narratives(team_id, ai_generated_at desc)
  where ai_content is not null;

-- Index pour les pages individuelles : SELECT * WHERE slug = ?
-- déjà couvert par l'index unique ci-dessus.
