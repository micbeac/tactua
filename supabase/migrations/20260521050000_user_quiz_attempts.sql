-- ============================================================================
-- Tactuo — Quiz quotidien : tentatives et scores
-- ============================================================================

create table if not exists public.user_quiz_attempts (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_day date not null,
  score int not null check (score >= 0 and score <= 100),
  total_questions int not null check (total_questions > 0),
  correct_answers int not null check (correct_answers >= 0),
  details_json jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now(),
  -- Un seul essai par user et par jour
  unique (user_id, quiz_day)
);

create index if not exists user_quiz_user_day_idx
  on public.user_quiz_attempts(user_id, quiz_day desc);

alter table public.user_quiz_attempts enable row level security;

drop policy if exists "own quiz attempts readable" on public.user_quiz_attempts;
create policy "own quiz attempts readable"
  on public.user_quiz_attempts
  for select
  using (auth.uid() = user_id);

drop policy if exists "own quiz attempts insertable" on public.user_quiz_attempts;
create policy "own quiz attempts insertable"
  on public.user_quiz_attempts
  for insert
  with check (auth.uid() = user_id);
