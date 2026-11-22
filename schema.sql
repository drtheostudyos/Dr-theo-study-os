-- Run this entire script in the SQL Editor of a NEW Supabase project.
create table if not exists public.study_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"topics":[]}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.study_data enable row level security;
drop policy if exists "Users can read own study data" on public.study_data;
drop policy if exists "Users can insert own study data" on public.study_data;
drop policy if exists "Users can update own study data" on public.study_data;
create policy "Users can read own study data" on public.study_data
  for select using (auth.uid() = user_id);
create policy "Users can insert own study data" on public.study_data
  for insert with check (auth.uid() = user_id);
create policy "Users can update own study data" on public.study_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
