-- ============================================================================
-- Tactuo — Table content_angles : angles vidéos TikTok prêts à produire
-- ============================================================================
-- Workflow :
--   1. cron / bouton admin → pour les matchs récemment finis OU à venir J-2,
--      génère 3 angles éditoriaux (SYSTEM_PROMPT_1) + 6 livrables prod par
--      angle (SYSTEM_PROMPT_2) via OpenAI gpt-4o.
--   2. Admin /admin/contenu : relit, valide/rejette, marque produit, publie.
--   3. Tracking URLs publiées + vues 24h/7j (saisie manuelle).
-- ============================================================================

create table if not exists public.content_angles (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  match_id bigint not null references public.matches(id) on delete cascade,
  -- 'post_match' (match terminé) ou 'pre_match' (avant coup d'envoi)
  generation_phase text not null default 'post_match'
    check (generation_phase in ('post_match', 'pre_match')),

  -- Méta angle (SYSTEM_PROMPT_1)
  format text,                  -- STAT_REVEAL, PLAYER_COMPARE, etc.
  hook text,
  title text,
  data_points jsonb,
  narrative text,
  joueur_principal text,
  club_principal text,
  championnat text,             -- PL | Liga | SerieA | Bundesliga | L1 | CDM | CL | JPL
  score_viralite numeric(3,1),
  cta_tactuo text,
  urgence text                  -- live | 24h | 72h | evergreen
    check (urgence in ('live','24h','72h','evergreen') or urgence is null),

  -- Livrables prod (SYSTEM_PROMPT_2 — contenus copiables)
  script_timecode text,
  prompt_elevenlabs text,
  prompts_visuels_ia jsonb,
  sources_visuels_a_chercher jsonb,
  instructions_capcut text,
  caption_tiktok text,
  hashtags text,

  -- Workflow
  status text not null default 'pending'
    check (status in ('pending','validated','rejected','produced','published')),
  validated_at timestamptz,
  produced_at timestamptz,
  published_at timestamptz,
  rejected_reason text,

  -- Tracking publication
  url_tiktok text,
  url_instagram text,
  url_youtube text,
  vues_24h integer,
  vues_7j integer,

  -- Modèle IA utilisé (traçabilité)
  ai_model text
);

create index if not exists content_angles_status_idx
  on public.content_angles(status);
create index if not exists content_angles_score_idx
  on public.content_angles(score_viralite desc nulls last);
create index if not exists content_angles_match_idx
  on public.content_angles(match_id);

-- Pas de RLS publique : tout reste en backoffice. L'accès se fait
-- uniquement via le service role (admin + routes API admin).
alter table public.content_angles enable row level security;

-- ============================================================================
-- Colonne sur matches pour marquer qu'on a déjà généré des angles
-- ============================================================================
-- Timestamp plutôt que boolean : permet la régénération conditionnelle
-- (« regénérer si > 7 j » par exemple) et garde la trace de quand c'est fait.
alter table public.matches
  add column if not exists angles_generated_at timestamptz;

create index if not exists matches_angles_generated_idx
  on public.matches(angles_generated_at);
