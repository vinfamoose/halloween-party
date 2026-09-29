-- Schema snapshot, generated 2026-09-29

create table public.categories (
  id uuid default gen_random_uuid() not null,
  name text not null,
  sort_order integer default 0 not null,
  individuals_mode text default 'none'::text,
  team_min_size integer,
  team_max_size integer,
  kind text
);

create table public.contestant_photos (
  id bigint generated always as identity not null,
  entry_id uuid,
  team_id uuid,
  path text not null,
  updated_at timestamp with time zone default now() not null
);

create table public.entries (
  id uuid default gen_random_uuid() not null,
  name text not null,
  costume text not null,
  team_id uuid,
  created_at timestamp with time zone default now() not null,
  gender text
);

create table public.teams (
  id uuid default gen_random_uuid() not null,
  display_name text not null,
  normalized_name text not null,
  created_at timestamp with time zone default now() not null
);

create table public.votes (
  device_id text not null,
  category_id uuid not null,
  entry_id uuid,
  team_id uuid,
  created_at timestamp with time zone default now() not null,
  voter_entry_id uuid
);

alter table public.categories add constraint categories_individuals_mode_check CHECK ((individuals_mode = ANY (ARRAY['none'::text, 'solo_only'::text, 'all'::text])));

alter table public.categories add constraint categories_pkey PRIMARY KEY (id);

alter table public.contestant_photos add constraint contestant_photos_check CHECK (((entry_id IS NULL) <> (team_id IS NULL)));

alter table public.contestant_photos add constraint contestant_photos_entry_id_key UNIQUE (entry_id);

alter table public.contestant_photos add constraint contestant_photos_pkey PRIMARY KEY (id);

alter table public.contestant_photos add constraint contestant_photos_team_id_key UNIQUE (team_id);

alter table public.entries add constraint entries_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text])));

alter table public.entries add constraint entries_pkey PRIMARY KEY (id);

alter table public.teams add constraint teams_normalized_name_key UNIQUE (normalized_name);

alter table public.teams add constraint teams_pkey PRIMARY KEY (id);

alter table public.votes add constraint votes_check CHECK ((((entry_id IS NOT NULL) AND (team_id IS NULL)) OR ((entry_id IS NULL) AND (team_id IS NOT NULL))));

alter table public.votes add constraint votes_pkey PRIMARY KEY (device_id, category_id);

alter table public.contestant_photos add constraint contestant_photos_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE;

alter table public.contestant_photos add constraint contestant_photos_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

alter table public.entries add constraint entries_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

alter table public.votes add constraint votes_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;

alter table public.votes add constraint votes_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE;

alter table public.votes add constraint votes_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

alter table public.votes add constraint votes_voter_entry_id_fkey FOREIGN KEY (voter_entry_id) REFERENCES entries(id) ON DELETE SET NULL;

CREATE INDEX votes_voter_entry_id_idx ON public.votes USING btree (voter_entry_id);

alter table public.categories enable row level security;

alter table public.contestant_photos enable row level security;

alter table public.entries enable row level security;

alter table public.teams enable row level security;

alter table public.votes enable row level security;

create policy "anyone reads categories" on public.categories as permissive for select to anon, authenticated using (true);

create policy "host reads categories" on public.categories as permissive for select to authenticated using (true);

create policy "read categories" on public.categories as permissive for select to public using (true);

create policy "anon writes photos" on public.contestant_photos as permissive for all to anon using (true) with check (true);

create policy "host writes photos" on public.contestant_photos as permissive for all to authenticated using (true) with check (true);

create policy "photos readable by everyone" on public.contestant_photos as permissive for select to anon, authenticated using (true);

create policy "anon manages entries" on public.entries as permissive for all to anon using (true) with check (true);

create policy "host manages entries" on public.entries as permissive for all to authenticated using (true) with check (true);

create policy "insert entries" on public.entries as permissive for insert to public with check (true);

create policy "read entries" on public.entries as permissive for select to public using (true);

create policy "anon manages teams" on public.teams as permissive for all to anon using (true) with check (true);

create policy "host manages teams" on public.teams as permissive for all to authenticated using (true) with check (true);

create policy "insert teams" on public.teams as permissive for insert to public with check (true);

create policy "read teams" on public.teams as permissive for select to public using (true);

create policy "update teams" on public.teams as permissive for update to public using (true) with check (true);

create policy "anon clears votes" on public.votes as permissive for delete to anon using (true);

create policy "host clears votes" on public.votes as permissive for delete to authenticated using (true);

create policy "host reads votes" on public.votes as permissive for select to authenticated using (true);

create policy "insert votes" on public.votes as permissive for insert to public with check (true);

create policy "read votes" on public.votes as permissive for select to public using (true);

create policy "update own vote" on public.votes as permissive for update to public using (true) with check (true);

create policy "anon deletes photo files" on storage.objects as permissive for delete to anon using ((bucket_id = 'photos'::text));

create policy "anon reads photo files" on storage.objects as permissive for select to anon using ((bucket_id = 'photos'::text));

create policy "anon replaces photo files" on storage.objects as permissive for update to anon using ((bucket_id = 'photos'::text)) with check ((bucket_id = 'photos'::text));

create policy "anon uploads photo files" on storage.objects as permissive for insert to anon with check ((bucket_id = 'photos'::text));

create policy "host deletes photos" on storage.objects as permissive for delete to authenticated using ((bucket_id = 'photos'::text));

create policy "host reads photos" on storage.objects as permissive for select to authenticated using ((bucket_id = 'photos'::text));

create policy "host replaces photos" on storage.objects as permissive for update to authenticated using ((bucket_id = 'photos'::text)) with check ((bucket_id = 'photos'::text));

create policy "host uploads photos" on storage.objects as permissive for insert to authenticated with check ((bucket_id = 'photos'::text));

create or replace view public.team_sizes as  SELECT team_id,
    count(*) AS member_count
   FROM entries
  WHERE (team_id IS NOT NULL)
  GROUP BY team_id;

create or replace view public.vote_log as  SELECT v.category_id,
    c.name AS category,
    voter.name AS voter,
    COALESCE(e.name, t.display_name) AS voted_for,
    v.device_id
   FROM ((((votes v
     LEFT JOIN categories c ON ((c.id = v.category_id)))
     LEFT JOIN entries voter ON ((voter.id = v.voter_entry_id)))
     LEFT JOIN entries e ON ((e.id = v.entry_id)))
     LEFT JOIN teams t ON ((t.id = v.team_id)));

insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;

alter publication supabase_realtime add table public.contestant_photos;

alter publication supabase_realtime add table public.entries;

alter publication supabase_realtime add table public.teams;

alter publication supabase_realtime add table public.votes;