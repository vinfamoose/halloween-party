-- CI ONLY. Runs after every migration has been applied to the throwaway database, and checks the
-- access rules behave as the site expects: guests can check in and vote, only admins can use the
-- admin controls, and closed voting really is closed. Any failed check stops with an error.

\set ON_ERROR_STOP on
\set QUIET on
\set admin_id '00000000-0000-0000-0000-00000000a001'
\set guest_id '00000000-0000-0000-0000-00000000b002'

\echo '1. The four categories are seeded'
do $$ begin
  if (select count(*) from public.categories) <> 4 then
    raise exception 'expected 4 categories, found %', (select count(*) from public.categories);
  end if;
end $$;

-- One admin account and one ordinary signed-in account.
insert into auth.users (id, email) values (:'admin_id', 'admin@example.test'), (:'guest_id', 'guest@example.test');
insert into public.admins (user_id) values (:'admin_id');

\echo '2. A guest (public key) can check in and vote'
set role anon;
insert into public.entries (id, name, costume, gender) values
  ('00000000-0000-0000-0000-0000000000e1', 'Jordan', 'Zombie', 'male'),
  ('00000000-0000-0000-0000-0000000000e2', 'Sam', 'Vampire', 'male');
insert into public.votes (device_id, category_id, entry_id, voter_entry_id)
  select 'd_1', id, '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2'
  from public.categories where kind = 'individual_male';

\echo '3. A guest cannot use any admin control'
do $$ begin
  begin perform public.admin_set_flags(p_voting_open => false); exception when insufficient_privilege then null; end;
  begin perform public.admin_clear_votes(); exception when insufficient_privilege then null; end;
  begin perform public.admin_start_fresh(); exception when insufficient_privilege then null; end;
  begin perform public.reset_guest_devices(); exception when insufficient_privilege then null; end;
  if not (select voting_open from public.app_state where id = 1) or (select count(*) from public.votes) <> 1
     or (select reset_generation from public.app_state where id = 1) <> 0 then
    raise exception 'a guest changed something through an admin control';
  end if;
end $$;
reset role;

\echo '4. A signed-in account that is not an admin cannot either'
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'guest_id', 'role', 'authenticated')::text, false) \g /dev/null
do $$ begin
  if public.is_admin() then raise exception 'is_admin() is true for a non-admin'; end if;
  begin perform public.reset_guest_devices(); exception when insufficient_privilege then return; end;
  raise exception 'a non-admin reset guest devices';
end $$;
reset role;

\echo '5. The admin closes voting, and guests can no longer vote'
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin_id', 'role', 'authenticated')::text, false) \g /dev/null
do $$ begin
  if not public.is_admin() then raise exception 'is_admin() is false for the admin'; end if;
  perform public.admin_set_flags(p_voting_open => false);
end $$;
reset role;
set role anon;
do $$ begin
  begin
    insert into public.votes (device_id, category_id, entry_id, voter_entry_id)
      select 'd_2', id, '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e1'
      from public.categories where kind = 'individual_male';
  exception when insufficient_privilege then return;
  end;
  raise exception 'a vote was accepted while voting was closed';
end $$;
reset role;

\echo '6. Hiding then revealing results records the reveal time'
set role authenticated;
do $$ begin
  perform public.admin_set_flags(p_results_visible => false);
  if (select results_revealed_at from public.app_state where id = 1) is not null then raise exception 'reveal time set while hidden'; end if;
  perform public.admin_set_flags(p_results_visible => true, p_voting_open => true);
  if (select results_revealed_at from public.app_state where id = 1) is null then raise exception 'reveal time not recorded'; end if;
end $$;

\echo '7. Clear all votes, reset devices and start fresh'
do $$ begin
  perform public.admin_clear_votes();
  if (select count(*) from public.votes) <> 0 then raise exception 'votes left after clearing'; end if;
  if public.reset_guest_devices() <> 1 then raise exception 'reset generation did not move to 1'; end if;
  perform public.admin_start_fresh();
  if (select count(*) from public.entries) <> 0 then raise exception 'guests left after start fresh'; end if;
  if (select count(*) from public.categories) <> 4 then raise exception 'start fresh removed categories'; end if;
end $$;
reset role;

\echo 'All checks passed.'
