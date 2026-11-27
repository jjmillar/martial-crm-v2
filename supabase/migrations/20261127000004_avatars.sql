-- Profile photos: students, teachers and every user's own account. Stored in a PRIVATE bucket ("avatars", storage
-- migration next to this one) and shown with short-lived signed URLs, never public links (many students are minors).
-- The column keeps the object path, always under the owner's own folder (enforced here), with a random file name:
--   students:  <school_id>/students/<student_id>/<random>.<ext>
--   teachers:  <school_id>/teachers/<teacher_id>/<random>.<ext>
--   accounts:  users/<user_id>/<random>.<ext>
-- Who may read / write each folder is decided by avatar_access() (used by the storage policies):
--   student photo: read = school members, the student and their guardians; write = school members (same as editing
--                  the record), the student and their guardians.
--   teacher photo: read = school members; write = school admins.
--   account photo: read = the user and anyone who shares a school with them; write = the user only.

alter table public.teachers add column avatar_url text;

-- Paths under the owner's own folder (no pointing at someone else's photo or at an external link).
update public.students set avatar_url = null where avatar_url is not null and avatar_url not like school_id::text || '/students/' || id::text || '/%';
update public.profiles set avatar_url = null where avatar_url is not null and avatar_url not like 'users/' || id::text || '/%';
alter table public.students add constraint students_avatar_path check (
  avatar_url is null or (avatar_url like school_id::text || '/students/' || id::text || '/%' and length(avatar_url) <= 200 and avatar_url !~ '\.\.'));
alter table public.teachers add constraint teachers_avatar_path check (
  avatar_url is null or (avatar_url like school_id::text || '/teachers/' || id::text || '/%' and length(avatar_url) <= 200 and avatar_url !~ '\.\.'));
alter table public.profiles add constraint profiles_avatar_path check (
  avatar_url is null or (avatar_url like 'users/' || id::text || '/%' and length(avatar_url) <= 200 and avatar_url !~ '\.\.'));

-- May the signed-in user read (p_write = false) or write (true) the avatar object at p_name?
create or replace function public.avatar_access(p_name text, p_write boolean)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare
  parts text[] := string_to_array(p_name, '/');
  sid uuid;
  oid uuid;
  st public.students;
  te public.teachers;
begin
  if auth.uid() is null or p_name is null or p_name ~ '\.\.' or coalesce(array_length(parts, 1), 0) not in (3, 4) then
    return false;
  end if;
  -- users/<uid>/<file>
  if parts[1] = 'users' and array_length(parts, 1) = 3 then
    if parts[2] !~ '^[0-9a-f-]{36}$' then return false; end if;
    oid := parts[2]::uuid;
    if oid = auth.uid() then return true; end if;
    if p_write then return false; end if;
    return public.is_ceo() or exists (
      select 1 from public.school_members a join public.school_members b on a.school_id = b.school_id
      where a.user_id = auth.uid() and b.user_id = oid);
  end if;
  -- <school>/<students|teachers>/<id>/<file>
  if array_length(parts, 1) <> 4 or parts[1] !~ '^[0-9a-f-]{36}$' or parts[3] !~ '^[0-9a-f-]{36}$' then return false; end if;
  sid := parts[1]::uuid;
  oid := parts[3]::uuid;
  if parts[2] = 'students' then
    select * into st from public.students where id = oid and school_id = sid;
    if not found then return false; end if;
    return public.is_school_member(sid) or oid in (select public.my_student_ids());
  elsif parts[2] = 'teachers' then
    select * into te from public.teachers where id = oid and school_id = sid;
    if not found then return false; end if;
    return case when p_write then public.has_school_role(sid, array['admin']::public.school_role[]) else public.is_school_member(sid) end;
  end if;
  return false;
end;
$$;
revoke execute on function public.avatar_access(text, boolean) from public, anon;
grant execute on function public.avatar_access(text, boolean) to authenticated;

-- A student (or their guardian) sets or removes the photo of their own record from the portal.
create or replace function public.set_my_student_photo(p_student_id uuid, p_path text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_student_id is null or p_student_id not in (select public.my_student_ids()) then raise exception 'not your student record'; end if;
  update public.students set avatar_url = nullif(btrim(coalesce(p_path, '')), '') where id = p_student_id and active;
  if not found then raise exception 'not your student record'; end if;
end;
$$;
revoke execute on function public.set_my_student_photo(uuid, text) from public, anon;
grant execute on function public.set_my_student_photo(uuid, text) to authenticated;
