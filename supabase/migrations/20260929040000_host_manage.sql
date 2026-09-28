-- Let the signed-in host manage guests: add, regroup and delete entries/teams, and clear the
-- votes that point at something being deleted. Guests (anon) keep whatever access they had.
-- If row-level security isn't enabled on these tables the policies are harmless no-ops.

drop policy if exists "host manages entries" on public.entries;
create policy "host manages entries" on public.entries
  for all to authenticated using (true) with check (true);

drop policy if exists "host manages teams" on public.teams;
create policy "host manages teams" on public.teams
  for all to authenticated using (true) with check (true);

drop policy if exists "host clears votes" on public.votes;
create policy "host clears votes" on public.votes
  for delete to authenticated using (true);

-- The host must also be able to read them all once signed in (anon-only select policies would hide rows).
drop policy if exists "host reads votes" on public.votes;
create policy "host reads votes" on public.votes
  for select to authenticated using (true);

drop policy if exists "host reads categories" on public.categories;
create policy "host reads categories" on public.categories
  for select to authenticated using (true);
