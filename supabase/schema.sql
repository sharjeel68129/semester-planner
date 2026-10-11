-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to run again.

-- One row per student. `events` is the Event[] from lib/schema.js, stored whole so a save
-- replaces the list in one step and can never leave it half-written.
create table if not exists public.planners (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  events jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row level security is what keeps students apart: the browser talks to the database directly
-- with the public key, and these policies only ever let a signed-in student touch their own row.
alter table public.planners enable row level security;

drop policy if exists "read own planner" on public.planners;
create policy "read own planner" on public.planners
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "create own planner" on public.planners;
create policy "create own planner" on public.planners
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "update own planner" on public.planners;
create policy "update own planner" on public.planners
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The student's settings (lib/settings.js). The policies above already cover it, because they are per row.
alter table public.planners add column if not exists settings jsonb not null default '{}'::jsonb;

-- Lets a signed-in student delete their own account from the Settings page, and only with their password.
-- It runs with the database owner's rights (security definer) because nobody else may touch auth.users,
-- but it can only ever delete the caller (auth.uid()), and only when the password matches the stored hash.
-- So a browser left signed in, or a stolen session, cannot delete the account without the password.
-- Deleting the user also deletes their planners row (on delete cascade above).
-- Returns true if the account was deleted, false if the password was wrong.
create or replace function public.delete_my_account(password text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.users
  where id = auth.uid()
    and encrypted_password = extensions.crypt(password, encrypted_password);
  return found;
end;
$$;

revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;
