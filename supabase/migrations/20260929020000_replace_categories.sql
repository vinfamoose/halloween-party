-- Set up the four votable categories. Safe to re-run: it never wipes categories that are
-- already correct, and only removes votes that point at categories being replaced.

-- The categories table may predate these columns.
alter table public.categories add column if not exists kind text;
alter table public.categories add column if not exists sort_order int;

-- Older versions of the table carried these columns instead of `kind`. The site no longer uses
-- them, so stop them from blocking inserts (their existing values stay untouched).
do $$
declare col text;
begin
  foreach col in array array['individuals_mode','team_min_size','team_max_size'] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'categories' and column_name = col
    ) then
      execute format('alter table public.categories alter column %I drop not null', col);
    end if;
  end loop;
end $$;

-- Drop any check constraint that limits `kind` to the old values.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.categories'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.categories drop constraint %I', c.conname);
  end loop;
end $$;

-- Remove old-style categories (and the votes that reference them).
delete from public.votes
where category_id in (
  select id from public.categories
  where kind is null or kind not in ('individual_male','individual_female','duo','group')
);
delete from public.categories
where kind is null or kind not in ('individual_male','individual_female','duo','group');

-- Add whichever of the four are missing.
insert into public.categories (name, kind, sort_order)
select v.name, v.kind, v.sort_order
from (values
  ('Individual Male',   'individual_male',   1),
  ('Individual Female', 'individual_female', 2),
  ('Best Duo',          'duo',               3),
  ('Best Group',        'group',             4)
) as v(name, kind, sort_order)
where not exists (select 1 from public.categories c where c.kind = v.kind);

-- Guests read categories with the public key.
drop policy if exists "anyone reads categories" on public.categories;
create policy "anyone reads categories" on public.categories
  for select to anon, authenticated using (true);
