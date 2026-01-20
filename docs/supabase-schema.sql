-- Supabase schema for the mobile app
-- Run this in the Supabase SQL editor (or via `supabase db push`) to create the
-- tables/policies the mobile client expects for profiles, saved recipes, and macro tracking.

-- Extensions (already present in most Supabase projects, but safe to re-run)
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Reusable trigger to keep updated_at in sync
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ======================================================================
-- profiles: quiz + user settings (references auth.users)
-- ======================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  goal text check (goal in ('bulk', 'lean_bulk', 'cut', 'maintain')),
  quiz jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'profiles_set_updated_at') then
    create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Profile read own') then
    create policy "Profile read own" on public.profiles
      for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Profile upsert own') then
    create policy "Profile upsert own" on public.profiles
      for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Profile update own') then
    create policy "Profile update own" on public.profiles
      for update using (auth.uid() = id);
  end if;
end $$;

create index if not exists profiles_email_idx on public.profiles (email);

-- ======================================================================
-- user_recipes: saved recipe library
-- ======================================================================
create table if not exists public.user_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  source_url text,
  video_url text,
  goal_type text check (goal_type in ('bulk', 'lean_bulk', 'cut', 'maintain')),
  macro_summary jsonb,
  original_recipe jsonb not null,
  modified_recipe jsonb,
  has_modified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'user_recipes_set_updated_at') then
    create trigger user_recipes_set_updated_at
    before update on public.user_recipes
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.user_recipes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_recipes' and policyname = 'User recipes select own') then
    create policy "User recipes select own" on public.user_recipes
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_recipes' and policyname = 'User recipes insert own') then
    create policy "User recipes insert own" on public.user_recipes
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_recipes' and policyname = 'User recipes update own') then
    create policy "User recipes update own" on public.user_recipes
      for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_recipes' and policyname = 'User recipes delete own') then
    create policy "User recipes delete own" on public.user_recipes
      for delete using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists user_recipes_user_created_idx on public.user_recipes (user_id, created_at desc);

-- ======================================================================
-- daily_macro_logs: per-user daily macro tracker
-- ======================================================================
create table if not exists public.daily_macro_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  entries jsonb not null default '[]'::jsonb,
  total_calories integer not null default 0,
  total_protein numeric not null default 0,
  total_carbs numeric not null default 0,
  total_fat numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_macro_logs_user_date_key unique (user_id, date)
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'daily_macro_logs_set_updated_at') then
    create trigger daily_macro_logs_set_updated_at
    before update on public.daily_macro_logs
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.daily_macro_logs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'daily_macro_logs' and policyname = 'Daily macros select own') then
    create policy "Daily macros select own" on public.daily_macro_logs
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'daily_macro_logs' and policyname = 'Daily macros insert own') then
    create policy "Daily macros insert own" on public.daily_macro_logs
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'daily_macro_logs' and policyname = 'Daily macros update own') then
    create policy "Daily macros update own" on public.daily_macro_logs
      for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'daily_macro_logs' and policyname = 'Daily macros delete own') then
    create policy "Daily macros delete own" on public.daily_macro_logs
      for delete using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists daily_macro_logs_user_date_idx on public.daily_macro_logs (user_id, date desc);
