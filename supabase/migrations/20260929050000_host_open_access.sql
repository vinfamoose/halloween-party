-- The host page has no login: it uses the same public (anon) key as the guest pages, so the
-- host's write access is granted to anon. The only protection is keeping host.html's link private.
-- (Anyone who has the site's public key could also call the API directly.)

-- Photo records
drop policy if exists "anon writes photos" on public.contestant_photos;
create policy "anon writes photos" on public.contestant_photos
  for all to anon using (true) with check (true);

-- Photo files
drop policy if exists "anon reads photo files" on storage.objects;
create policy "anon reads photo files" on storage.objects
  for select to anon using (bucket_id = 'photos');
drop policy if exists "anon uploads photo files" on storage.objects;
create policy "anon uploads photo files" on storage.objects
  for insert to anon with check (bucket_id = 'photos');
drop policy if exists "anon replaces photo files" on storage.objects;
create policy "anon replaces photo files" on storage.objects
  for update to anon using (bucket_id = 'photos') with check (bucket_id = 'photos');
drop policy if exists "anon deletes photo files" on storage.objects;
create policy "anon deletes photo files" on storage.objects
  for delete to anon using (bucket_id = 'photos');

-- Guest list management (add / regroup / delete)
drop policy if exists "anon manages entries" on public.entries;
create policy "anon manages entries" on public.entries
  for all to anon using (true) with check (true);
drop policy if exists "anon manages teams" on public.teams;
create policy "anon manages teams" on public.teams
  for all to anon using (true) with check (true);
drop policy if exists "anon clears votes" on public.votes;
create policy "anon clears votes" on public.votes
  for delete to anon using (true);
