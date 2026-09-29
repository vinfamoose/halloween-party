-- When the admin flips "Results visible" from off to on, remember the moment. The results pages show the
-- Best Host award 30 seconds later, even if the big screen is reloaded in between.

alter table public.app_state add column if not exists results_revealed_at timestamptz;

create or replace function public.admin_set_flags(p_voting_open boolean default null, p_results_visible boolean default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.app_state
     set results_revealed_at = case when p_results_visible and not results_visible then now()
                                    when p_results_visible = false then null
                                    else results_revealed_at end,
         voting_open = coalesce(p_voting_open, voting_open),
         results_visible = coalesce(p_results_visible, results_visible),
         updated_at = now()
   where id = 1;
end;
$$;
