-- ============================================================================
-- Tactuo — Éditorialisation des actualités clubs (team_narratives)
-- ============================================================================
-- La table wc_news (Coupe du Monde) disposait déjà de tout l'outillage
-- rédactionnel : catégorie, statut de publication, vidéo YouTube, date
-- d'édition. Les actualités clubs, elles, étaient générées et publiées sans
-- qu'aucun écran ne permette de les relire, les corriger ou les retirer.
--
-- On aligne team_narratives sur wc_news pour pouvoir bâtir le même
-- back-office, et pour permettre le filtrage par catégorie demandé sur le
-- fil public.
-- ============================================================================

alter table public.team_narratives
  -- Catégorie éditoriale, déduite à la génération puis corrigeable à la main.
  add column if not exists category text,
  -- 'published' par défaut : les articles existants restent visibles, on ne
  -- masque rien rétroactivement.
  add column if not exists status text not null default 'published',
  -- Identifiant de la vidéo (pas l'URL complète) : plus simple à intégrer.
  add column if not exists video_youtube_id text,
  -- Meta description propre. À défaut, l'affichage retombe sur ai_summary.
  add column if not exists meta_description text,
  -- Trace d'une retouche manuelle, pour distinguer le rédigé du généré.
  add column if not exists edited_at timestamptz,
  -- Nom lisible du média source (L'Équipe, Foot Mercato…).
  add column if not exists source_name text;

-- Le fil public filtre sur le statut et la catégorie, et trie par date :
-- sans index, chaque chargement scanne toute la table.
create index if not exists team_narratives_status_published_idx
  on public.team_narratives (status, published_at desc nulls last);

create index if not exists team_narratives_category_idx
  on public.team_narratives (category)
  where category is not null;

comment on column public.team_narratives.category is
  'Catégorie éditoriale : mercato | avant_match | blessure | resultat | club';
comment on column public.team_narratives.status is
  'draft | published | archived';
