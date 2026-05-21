-- ============================================================================
-- Tactuo — Admin foundations
-- ============================================================================
-- 1) Étend profiles : rôle admin, statut abonnement, tracking referral
-- 2) Crée email_templates, partners, promo_codes, partner_referrals
-- 3) RLS : tout est verrouillé sauf accès admin (via fonction is_admin())
-- ============================================================================

-- --- 1. Extension de profiles ------------------------------------------------

alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists subscription_status text not null default 'free'
    check (subscription_status in ('free', 'trial', 'paid', 'admin_grant', 'suspended')),
  add column if not exists subscription_expires_at timestamptz,
  add column if not exists subscription_notes text,
  add column if not exists signup_ref_code text,   -- code partenaire saisi à l'inscription (ex "?ref=...")
  add column if not exists last_seen_at timestamptz;

create index if not exists profiles_subscription_status_idx
  on public.profiles(subscription_status);
create index if not exists profiles_signup_ref_code_idx
  on public.profiles(signup_ref_code);

-- --- 2. Fonction utilitaire is_admin() pour les policies RLS -----------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- --- 3. Table email_templates -----------------------------------------------

create table if not exists public.email_templates (
  id bigserial primary key,
  key text not null unique,             -- 'welcome', 'daily_digest', 'partner_promo', ...
  subject text not null,
  body_md text not null,                -- Markdown source, on rendra côté code
  description text,
  variables jsonb not null default '[]'::jsonb,  -- ex: [{"name":"user_name","example":"Alice"}]
  is_active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_templates enable row level security;
drop policy if exists "admin reads templates" on public.email_templates;
create policy "admin reads templates"
  on public.email_templates for select using (public.is_admin());
drop policy if exists "admin writes templates" on public.email_templates;
create policy "admin writes templates"
  on public.email_templates for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seed des templates de base
insert into public.email_templates (key, subject, body_md, description)
values
  ('welcome',
   'Bienvenue sur Tactuo ⚽',
   E'Salut {{user_name}},\n\nMerci d''avoir rejoint Tactuo ! Pour bien démarrer :\n\n- Ajoute tes équipes favorites pour personnaliser ton dashboard\n- Découvre l''analyse IA d''un match à venir\n- Tente le quiz du jour\n\nÀ très vite,\nL''équipe Tactuo',
   'Email envoyé automatiquement après la création d''un compte.'),
  ('partner_promo',
   '{{partner_name}} te recommande Tactuo',
   E'Salut,\n\n{{partner_name}} t''a recommandé Tactuo. Avec le code **{{promo_code}}** tu bénéficies de {{discount}} sur ton abonnement.\n\nProfite de l''offre →\n\nÀ bientôt,\nL''équipe Tactuo',
   'Template d''email pour campagnes partenaires. Édite avant chaque envoi.')
on conflict (key) do nothing;

-- --- 4. Table partners ------------------------------------------------------

create table if not exists public.partners (
  id bigserial primary key,
  name text not null,
  slug text not null unique,            -- utilisé dans l'URL "?ref=slug"
  email text,
  notes text,
  commission_pct numeric(5,2) not null default 0,   -- ex 20.00 = 20% sur les abonnements convertis
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists partners_slug_idx on public.partners(slug);

alter table public.partners enable row level security;
drop policy if exists "admin reads partners" on public.partners;
create policy "admin reads partners"
  on public.partners for select using (public.is_admin());
drop policy if exists "admin writes partners" on public.partners;
create policy "admin writes partners"
  on public.partners for all
  using (public.is_admin())
  with check (public.is_admin());

-- --- 5. Table promo_codes ---------------------------------------------------

create table if not exists public.promo_codes (
  id bigserial primary key,
  code text not null unique,            -- ex "INFLUX10"
  discount_type text not null check (discount_type in ('percent', 'fixed_eur')),
  discount_value numeric(8,2) not null,  -- 10 ou 5.00
  partner_id bigint references public.partners(id) on delete set null,
  max_uses int,                         -- null = illimité
  used_count int not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists promo_codes_code_idx on public.promo_codes(code);
create index if not exists promo_codes_partner_idx on public.promo_codes(partner_id);

alter table public.promo_codes enable row level security;
drop policy if exists "admin reads codes" on public.promo_codes;
create policy "admin reads codes"
  on public.promo_codes for select using (public.is_admin());
drop policy if exists "admin writes codes" on public.promo_codes;
create policy "admin writes codes"
  on public.promo_codes for all
  using (public.is_admin())
  with check (public.is_admin());

-- --- 6. Table partner_referrals ---------------------------------------------
-- Une ligne par (user, partenaire) — créée à l'inscription si le user a
-- un ref code valide. Update au passage payant.

create table if not exists public.partner_referrals (
  id bigserial primary key,
  partner_id bigint not null references public.partners(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  promo_code_id bigint references public.promo_codes(id) on delete set null,
  signed_up_at timestamptz not null default now(),
  became_paying_at timestamptz,         -- null tant que pas converti
  amount_paid_eur numeric(8,2),
  commission_due_eur numeric(8,2),
  notes text,
  unique (partner_id, user_id)
);

create index if not exists partner_referrals_partner_idx
  on public.partner_referrals(partner_id, became_paying_at);

alter table public.partner_referrals enable row level security;
drop policy if exists "admin reads referrals" on public.partner_referrals;
create policy "admin reads referrals"
  on public.partner_referrals for select using (public.is_admin());
drop policy if exists "admin writes referrals" on public.partner_referrals;
create policy "admin writes referrals"
  on public.partner_referrals for all
  using (public.is_admin())
  with check (public.is_admin());

-- --- 7. Trigger updated_at sur email_templates ------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists email_templates_updated_at on public.email_templates;
create trigger email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

-- --- 8. Bootstrap : promouvoir le premier admin -----------------------------
-- ⚠️  Adapter l'email ici si besoin (par défaut : micbeac@gmail.com)

update public.profiles
set is_admin = true
where id in (
  select id from auth.users where email = 'micbeac@gmail.com'
);
