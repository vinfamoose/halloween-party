-- Admin controls on host.html: open/close voting, hide/reveal results, clear all votes, start fresh.
-- Every write goes through an admin-only function (is_admin(), from 20260929070000).

alter table public.app_state add column if not exists voting_open boolean not null default true;
alter table public.app_state add column if not exists results_visible boolean not null default true;
-- Bumped when all votes are cleared, so phones forget which votes they cast (without forgetting their check-in).
alter table public.app_state add column if not exists votes_generation int not null default 0;

-- ---------- Voting open/closed, enforced on the votes table ----------
create or replace function public.voting_is_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select voting_open from public.app_state where id = 1), true);
$$;
grant execute on function public.voting_is_open() to anon, authenticated;

drop policy if exists "insert votes" on public.votes;
create policy "insert votes" on public.votes
  for insert to public with check (public.voting_is_open());
drop policy if exists "update own vote" on public.votes;
create policy "update own vote" on public.votes
  for update to public using (true) with check (public.voting_is_open());

-- ---------- Admin functions ----------
create or replace function public.admin_set_flags(p_voting_open boolean default null, p_results_visible boolean default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.app_state
     set voting_open = coalesce(p_voting_open, voting_open),
         results_visible = coalesce(p_results_visible, results_visible),
         updated_at = now()
   where id = 1;
end;
$$;

create or replace function public.admin_clear_votes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  delete from public.votes where true;
  update public.app_state set votes_generation = votes_generation + 1, updated_at = now() where id = 1;
end;
$$;

-- Deletes every guest, group, vote and photo record, and resets every guest device.
-- Photo files live in Storage, which can't be emptied from SQL; host.html removes them before calling this.
create or replace function public.admin_start_fresh()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  delete from public.votes where true;
  delete from public.contestant_photos where true;
  delete from public.entries where true;
  delete from public.teams where true;
  update public.app_state
     set reset_generation = reset_generation + 1, votes_generation = votes_generation + 1, updated_at = now()
   where id = 1;
end;
$$;

revoke all on function public.admin_set_flags(boolean, boolean) from public, anon;
revoke all on function public.admin_clear_votes() from public, anon;
revoke all on function public.admin_start_fresh() from public, anon;
grant execute on function public.admin_set_flags(boolean, boolean) to authenticated;
grant execute on function public.admin_clear_votes() to authenticated;
grant execute on function public.admin_start_fresh() to authenticated;
