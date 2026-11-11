-- Storage buckets (S1, S6). Not run by the PGlite harness (no storage schema there); verified live.
-- receipts: private, path '<school_id>/<payment_id>/<file>'. logos: public read, path '<school_id>/<file>'.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('logos', 'logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

-- First folder of the object name is the school id.
create or replace function public.storage_school_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f-]{36}$' then split_part(p_name, '/', 1)::uuid end
$$;

create policy receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_school_member(public.storage_school_id(name)));
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_school_member(public.storage_school_id(name)));
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.has_school_role(public.storage_school_id(name), array['admin']::public.school_role[]));

-- Logos are public to read (shown on the school profile); only admins of that school write them.
create policy logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.has_school_role(public.storage_school_id(name), array['admin']::public.school_role[]));
create policy logos_update on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.has_school_role(public.storage_school_id(name), array['admin']::public.school_role[]));
create policy logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and public.has_school_role(public.storage_school_id(name), array['admin']::public.school_role[]));
