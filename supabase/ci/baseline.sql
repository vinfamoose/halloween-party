-- CI ONLY. The tables as they were before the first migration (they were created by hand in the
-- SQL Editor, so no migration makes them). The "Migrations" GitHub Action copies this in ahead of
-- supabase/migrations/ in a throwaway database, so the migrations can be checked from scratch.
-- It lives outside supabase/migrations/ on purpose: it must never run against the real project.
-- Reconstructed from supabase/schema.sql minus what each migration adds.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  individuals_mode text default 'none' check (individuals_mode in ('none', 'solo_only', 'all')),
  team_min_size integer,
  team_max_size integer,
  kind text
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  normalized_name text not null unique,
  created_at timestamptz not null default now()
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  costume text not null,
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.votes (
  device_id text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  entry_id uuid references public.entries(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (device_id, category_id),
  check ((entry_id is not null and team_id is null) or (entry_id is null and team_id is not null))
);

create view public.team_sizes as
  select team_id, count(*) as member_count from public.entries where team_id is not null group by team_id;

alter table public.categories enable row level security;
alter table public.entries enable row level security;
alter table public.teams enable row level security;
alter table public.votes enable row level security;

create policy "read categories" on public.categories for select to public using (true);
create policy "read entries" on public.entries for select to public using (true);
create policy "insert entries" on public.entries for insert to public with check (true);
create policy "read teams" on public.teams for select to public using (true);
create policy "insert teams" on public.teams for insert to public with check (true);
create policy "update teams" on public.teams for update to public using (true) with check (true);
create policy "read votes" on public.votes for select to public using (true);
create policy "insert votes" on public.votes for insert to public with check (true);
create policy "update own vote" on public.votes for update to public using (true) with check (true);

alter publication supabase_realtime add table public.entries, public.teams, public.votes;
