-- Supabase schema for G.A.D.U. (client-side access with anon key)
-- Run this in the Supabase SQL editor before launching the app.

create extension if not exists "uuid-ossp";

create table if not exists public.app_settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  db_version integer not null default 1,
  schema_version integer not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists members_lastname_idx on public.members ((data ->> 'lastName'));

create table if not exists public.convocazioni (
  id uuid primary key default gen_random_uuid(),
  branch_type text not null,
  year_start integer not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists convocazioni_branch_idx on public.convocazioni (branch_type);
create index if not exists convocazioni_year_idx on public.convocazioni (year_start);

-- RLS: Permissive policies for authenticated users (all authenticated users have full access)
-- UI-side controls handle specific permissions, not database RLS
alter table public.app_settings enable row level security;
alter table public.members enable row level security;
alter table public.convocazioni enable row level security;

drop policy if exists "anon_all_app_settings" on public.app_settings;
drop policy if exists "anon_all_members" on public.members;
drop policy if exists "anon_all_convocazioni" on public.convocazioni;

drop policy if exists "authenticated_all_app_settings" on public.app_settings;
drop policy if exists "authenticated_all_members" on public.members;
drop policy if exists "authenticated_all_convocazioni" on public.convocazioni;

-- Authenticated users can do everything
create policy "authenticated_all_app_settings" 
  on public.app_settings 
  for all 
  using (auth.role() = 'authenticated') 
  with check (auth.role() = 'authenticated');

create policy "authenticated_all_members" 
  on public.members 
  for all 
  using (auth.role() = 'authenticated') 
  with check (auth.role() = 'authenticated');

create policy "authenticated_all_convocazioni" 
  on public.convocazioni 
  for all 
  using (auth.role() = 'authenticated') 
  with check (auth.role() = 'authenticated');

-- Keep anon policies for demo mode (fallback)
create policy "anon_all_app_settings" on public.app_settings for all using (auth.role() = 'anon') with check (auth.role() = 'anon');
create policy "anon_all_members" on public.members for all using (auth.role() = 'anon') with check (auth.role() = 'anon');
create policy "anon_all_convocazioni" on public.convocazioni for all using (auth.role() = 'anon') with check (auth.role() = 'anon');
