-- Profile photos bucket: PRIVATE (signed URLs only), 2 MB, images only (the app re-encodes to JPEG/WebP, which also
-- drops EXIF data such as GPS). Who reads / writes each path is decided by public.avatar_access().
-- Not run by the PGlite harness (no storage schema there).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.avatar_access(name, false));
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.avatar_access(name, true));
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.avatar_access(name, true))
  with check (bucket_id = 'avatars' and public.avatar_access(name, true));
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.avatar_access(name, true));
