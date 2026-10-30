-- The reveal, run from the Admin tab's Results panel instead of one "Results visible" switch:
--   * each category's places are turned over one at a time, 3rd first, then 2nd, then 1st;
--   * the Best Host award pops up when the admin presses its button, not on a timer.
-- The results pages read both from app_state, which they already follow live.

-- category id -> the best place shown so far (3, 2 or 1); a category that isn't listed shows nothing.
alter table public.app_state add column if not exists revealed jsonb not null default '{}'::jsonb;
alter table public.app_state add column if not exists award_shown boolean not null default false;

-- p_place 3, 2 or 1 shows that place and every place below it; 0 hides the category again.
-- With no category, p_place must be 0 and every category is hidden.
create or replace function public.admin_set_reveal(p_category uuid default null, p_place int default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_place is null or p_place not between 0 and 3 or (p_category is null and p_place <> 0) then
    raise exception 'place must be 0 to 3, and 0 when hiding every category' using errcode = '22023';
  end if;
  update public.app_state
     set revealed = case when p_category is null then '{}'::jsonb
                         when p_place = 0 then revealed - p_category::text
                         else revealed || jsonb_build_object(p_category::text, p_place) end,
         updated_at = now()
   where id = 1;
end;
$$;

create or replace function public.admin_show_award(p_shown boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.app_state set award_shown = coalesce(p_shown, false), updated_at = now() where id = 1;
end;
$$;

-- Clearing the votes or starting fresh also puts every card face-down and takes the award down,
-- so a test run's reveal doesn't carry over to the real one.
create or replace function public.admin_clear_votes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  delete from public.votes where true;
  update public.app_state
     set votes_generation = votes_generation + 1, revealed = '{}'::jsonb, award_shown = false, updated_at = now()
   where id = 1;
end;
$$;

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
     set reset_generation = reset_generation + 1, votes_generation = votes_generation + 1,
         revealed = '{}'::jsonb, award_shown = false, updated_at = now()
   where id = 1;
end;
$$;

revoke all on function public.admin_set_reveal(uuid, int) from public, anon;
revoke all on function public.admin_show_award(boolean) from public, anon;
grant execute on function public.admin_set_reveal(uuid, int) to authenticated;
grant execute on function public.admin_show_award(boolean) to authenticated;
