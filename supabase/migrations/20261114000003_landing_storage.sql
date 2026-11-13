-- Public bucket for landing-page photos, path '<school_id>/<file>'. Admins/owners of the school write.
-- Not run by the PGlite harness (no storage schema there).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('landing', 'landing', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy landing_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'landing' and public.has_school_role(public.storage_school_id(name), array['admin']::public.school_role[]));
create policy landing_update on storage.objects for update to authenticated
  using (bucket_id = 'landing' and public.has_school_role(public.storage_school_id(name), array['admin']::public.school_role[]));
create policy landing_delete on storage.objects for delete to authenticated
  using (bucket_id = 'landing' and public.has_school_role(public.storage_school_id(name), array['admin']::public.school_role[]));
