-- The main site's landing shows the plans a new academy can subscribe to: the active paid plans only (no internal
-- "Cortesía" plan), and only what a price list shows (no ids of customers, no counts). Public: granted to anon.
create or replace function public.public_plans()
returns table (id uuid, name text, price_clp integer, period text, max_schools integer, max_students integer)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, p.price_clp, p.period, p.max_schools, p.max_students
  from public.platform_plans p
  where p.active and p.price_clp > 0
  order by p.price_clp, p.name;
$$;
revoke execute on function public.public_plans() from public;
grant execute on function public.public_plans() to anon, authenticated;
