-- Record which registered person placed each vote.
-- entries.id's type isn't declared in the repo, so match it dynamically.
do $$
declare
  id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into id_type
  from pg_attribute a
  where a.attrelid = 'public.entries'::regclass and a.attname = 'id' and not a.attisdropped;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'votes' and column_name = 'voter_entry_id'
  ) then
    execute format(
      'alter table public.votes add column voter_entry_id %s references public.entries(id) on delete set null',
      id_type
    );
  end if;
end $$;

create index if not exists votes_voter_entry_id_idx on public.votes (voter_entry_id);

-- Convenience view for reviewing who voted for what.
create or replace view public.vote_log as
select
  v.category_id,
  c.name  as category,
  voter.name as voter,
  coalesce(e.name, t.display_name) as voted_for,
  v.device_id
from public.votes v
left join public.categories c on c.id = v.category_id
left join public.entries voter on voter.id = v.voter_entry_id
left join public.entries e on e.id = v.entry_id
left join public.teams t on t.id = v.team_id;
