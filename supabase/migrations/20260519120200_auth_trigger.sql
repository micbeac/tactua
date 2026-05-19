-- ============================================================================
-- Tactua — Trigger auto-création de profile à chaque signup
-- ============================================================================
-- À chaque INSERT dans auth.users (signup Supabase Auth), on crée
-- automatiquement la ligne public.profiles correspondante.
--
-- SECURITY DEFINER : la fonction tourne avec les droits de son propriétaire
-- (postgres) → contourne RLS et peut écrire dans public.profiles.
-- SET search_path = public, auth : empêche les attaques par hijacking de
-- search_path (best practice Supabase).
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

-- Trigger sur auth.users : exécuté après chaque INSERT.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
