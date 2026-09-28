-- Gender on entries, used to split solo entries into Male / Female categories.
alter table public.entries add column if not exists gender text;
alter table public.entries drop constraint if exists entries_gender_check;
alter table public.entries add constraint entries_gender_check check (gender in ('male','female'));

-- categories.kind may carry a check constraint listing the old kinds; drop it
-- so the new kinds (individual_male, individual_female, duo, group) are allowed.
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
