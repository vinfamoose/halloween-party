-- Admin panel on host.html: signed-in Supabase Auth users listed in public.admins.
-- The rest of the host page stays open (see 20260929050000); only admin actions are gated here, in the
-- database, so hiding the buttons isn't the only protection.
--
-- After running this, add yourself (Authentication -> Users -> Add user first, if needed):
--   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
-- RLS on with no policies: nobody reads or writes it through the API; is_admin() looks it up.
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Resetting guest devices is now admin-only.
create or replace function public.reset_guest_devices()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  gen int;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update public.app_state
     set reset_generation = reset_generation + 1, updated_at = now()
   where id = 1
  returning reset_generation into gen;
  return gen;
end;
$$;
revoke all on function public.reset_guest_devices() from public, anon;
grant execute on function public.reset_guest_devices() to authenticated;
