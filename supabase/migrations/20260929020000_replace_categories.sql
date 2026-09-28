-- Replace the old categories with the new four. Votes are removed first because
-- they reference categories; all data is being cleared before the party anyway.
delete from public.votes;
delete from public.categories;

insert into public.categories (name, kind, sort_order) values
  ('Individual Male',   'individual_male',   1),
  ('Individual Female', 'individual_female', 2),
  ('Best Duo',          'duo',               3),
  ('Best Group',        'group',             4);
