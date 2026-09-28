-- Host-taken photos for entries (individuals) and teams (groups).
--
-- Access model: everyone can READ photos (guests see them on the voting page); only a signed-in
-- Supabase Auth user (the host) can write. For that to mean "only the host", turn OFF public
-- sign-ups in the dashboard (Authentication -> Sign In / Providers -> "Allow new users to sign up")
-- and create the host user by hand (Authentication -> Users -> Add user).

-- entries.id / teams.id types aren't declared in the repo, so match them dynamically.
do $$
declare
  entry_type text;
  team_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into entry_type
  from pg_attribute a
  where a.attrelid = 'public.entries'::regclass and a.attname = 'id' and not a.attisdropped;
  select format_type(a.atttypid, a.atttypmod) into team_type
  from pg_attribute a
  where a.attrelid = 'public.teams'::regclass and a.attname = 'id' and not a.attisdropped;

  if to_regclass('public.contestant_photos') is null then
    execute format($f$
      create table public.contestant_photos (
        id         bigint generated always as identity primary key,
        entry_id   %s unique references public.entries(id) on delete cascade,
        team_id    %s unique references public.teams(id) on delete cascade,
        path       text not null,
        updated_at timestamptz not null default now(),
        check ((entry_id is null) <> (team_id is null))
      )$f$, entry_type, team_type);
  end if;
end $$;

alter table public.contestant_photos enable row level security;

drop policy if exists "photos readable by everyone" on public.contestant_photos;
create policy "photos readable by everyone" on public.contestant_photos
  for select to anon, authenticated using (true);

drop policy if exists "host writes photos" on public.contestant_photos;
create policy "host writes photos" on public.contestant_photos
  for all to authenticated using (true) with check (true);

-- Storage bucket for the image files themselves (public URLs, host-only writes).
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists "host uploads photos" on storage.objects;
create policy "host uploads photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');

drop policy if exists "host replaces photos" on storage.objects;
create policy "host replaces photos" on storage.objects
  for update to authenticated using (bucket_id = 'photos') with check (bucket_id = 'photos');

drop policy if exists "host deletes photos" on storage.objects;
create policy "host deletes photos" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');

-- Live updates for the voting page when a photo lands.
do $$ begin
  alter publication supabase_realtime add table public.contestant_photos;
exception when others then null;
end $$;

-- Upserting a replacement photo needs the host to be able to see the existing object.
drop policy if exists "host reads photos" on storage.objects;
create policy "host reads photos" on storage.objects
  for select to authenticated using (bucket_id = 'photos');
