do $$
declare
  t text;
begin
  foreach t in array array[
    'messages','conversations','contacts','deals','appointments',
    'pipeline_stages','teams','team_functions','team_members'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I;', t);
    end if;
  end loop;
end $$;