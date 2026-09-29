-- "Reset all guest devices" on the host page. Guest phones keep their check-in, votes and device id in
-- cookies/localStorage, which the host can't reach directly. Instead the host bumps reset_generation;
-- party.html compares it with the generation it last saw and wipes its own stored data when it changes.

create table if not exists public.app_state (
  id               int primary key default 1 check (id = 1),
  reset_generation int not null default 0,
  updated_at       timestamptz not null default now()
);
insert into public.app_state (id) values (1) on conflict (id) do nothing;

alter table public.app_state enable row level security;
drop policy if exists "anon reads app state" on public.app_state;
create policy "anon reads app state" on public.app_state
  for select to anon, authenticated using (true);

-- The only write: bump the counter. Same no-login model as the rest of the host page.
create or replace function public.reset_guest_devices()
returns int
language sql
security definer
set search_path = public
as $$
  update public.app_state
     set reset_generation = reset_generation + 1, updated_at = now()
   where id = 1
  returning reset_generation;
$$;
revoke all on function public.reset_guest_devices() from public;
grant execute on function public.reset_guest_devices() to anon, authenticated;

-- Pages that are open when the host resets clear themselves straight away.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_state') then
    alter publication supabase_realtime add table public.app_state;
  end if;
end $$;
