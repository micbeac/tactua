-- Push notifications : Web Push API (gratuit, standard).
-- Schema :
--   push_subscriptions : abonnements des users
--   push_preferences : finetuning (quels events, quelles equipes, etc.)
--   push_log : envois pour debug + analytics

-- 1. Subscriptions
create table if not exists public.push_subscriptions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Une seule subscription par endpoint
  unique (endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own subscriptions readable" on public.push_subscriptions;
create policy "own subscriptions readable"
  on public.push_subscriptions for select using (auth.uid() = user_id);

drop policy if exists "own subscriptions deletable" on public.push_subscriptions;
create policy "own subscriptions deletable"
  on public.push_subscriptions for delete using (auth.uid() = user_id);

-- Insert via service role uniquement (depuis les endpoints serveur).

-- 2. Préférences
create table if not exists public.push_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notify_goals boolean not null default true,
  notify_lineup_confirmed boolean not null default true,
  notify_admin_broadcast boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.push_preferences enable row level security;

drop policy if exists "own prefs readable" on public.push_preferences;
create policy "own prefs readable"
  on public.push_preferences for select using (auth.uid() = user_id);

drop policy if exists "own prefs writable" on public.push_preferences;
create policy "own prefs writable"
  on public.push_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Marquer les events deja pousses (pour ne pas spam)
alter table public.match_events
  add column if not exists pushed_at timestamptz;

create index if not exists match_events_unpushed_idx
  on public.match_events(match_id, type)
  where pushed_at is null;

-- Marquer les lineups deja poussées
alter table public.match_lineups
  add column if not exists pushed_at timestamptz;

-- 4. Log pour debug + analytics admin
create table if not exists public.push_log (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  type text not null,           -- 'goal', 'lineup', 'admin_broadcast'
  title text,
  body text,
  url text,
  status text not null,         -- 'sent' | 'failed' | 'expired'
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists push_log_sent_idx on public.push_log(sent_at desc);

alter table public.push_log enable row level security;

-- Lecture admin uniquement (via is_admin())
drop policy if exists "admin reads push log" on public.push_log;
create policy "admin reads push log"
  on public.push_log for select using (public.is_admin());
