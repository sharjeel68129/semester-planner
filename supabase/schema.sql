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
