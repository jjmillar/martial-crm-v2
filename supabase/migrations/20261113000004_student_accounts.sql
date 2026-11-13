-- Card items 6 + 7: student accounts, links between student / teacher / member, self check-in confirmed by
-- staff, and XP (10 per confirmed attendance, 100 per level; per-tag XP = skills).
--
-- Design: a student account is students.user_id (NOT a school_members row). is_school_member() keeps meaning
-- "staff", so every existing staff policy stays closed to students; students get narrow, explicit read policies.

-- 1. Links ------------------------------------------------------------------------------------------------
alter table public.students add column user_id uuid references auth.users (id) on delete set null;
create unique index students_school_user_key on public.students (school_id, user_id) where user_id is not null;

alter table public.teachers add column student_id uuid;
alter table public.teachers add constraint teachers_student_fk
  foreign key (student_id, school_id) references public.students (id, school_id) on delete set null (student_id);
create unique index teachers_school_student_key on public.teachers (school_id, student_id) where student_id is not null;

-- Only admins (or the service role used by the student-access function) may change which account a student
-- uses: staff "user" role can edit student data but must not hand a student's portal to another account.
create or replace function public.guard_student_user()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from (case when tg_op = 'UPDATE' then old.user_id end)
     and auth.uid() is not null
     and not public.has_school_role(new.school_id, array['admin']::public.school_role[]) then
    raise exception 'only admins can link a student account';
  end if;
  return new;
end;
$$;

create trigger students_guard_user before insert or update of user_id on public.students
  for each row execute function public.guard_student_user();

-- 2. Who am I as a student -------------------------------------------------------------------------------
create or replace function public.is_student_user(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.students where school_id = p_school_id and user_id = auth.uid() and active);
$$;

create or replace function public.my_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.students where user_id = auth.uid() and active;
$$;

-- 3. Narrow read access for students ---------------------------------------------------------------------
create policy schools_select_student on public.schools for select to authenticated using (public.is_student_user(id));
create policy students_select_own on public.students for select to authenticated using (user_id = auth.uid());
create policy classes_select_student on public.classes for select to authenticated using (public.is_student_user(school_id));
create policy class_schedules_select_student on public.class_schedules for select to authenticated using (public.is_student_user(school_id));
create policy class_tags_select_student on public.class_tags for select to authenticated using (public.is_student_user(school_id));
create policy tags_select_student on public.tags for select to authenticated using (public.is_student_user(school_id));
create policy plans_select_student on public.plans for select to authenticated using (public.is_student_user(school_id));
create policy attendance_select_own on public.attendance for select to authenticated using (student_id in (select public.my_student_ids()));
create policy enrollments_select_own on public.enrollments for select to authenticated using (student_id in (select public.my_student_ids()));
create policy payments_select_own on public.payments for select to authenticated using (student_id in (select public.my_student_ids()));

-- 4. Attendance: self check-in + staff confirmation --------------------------------------------------------
alter table public.attendance
  add column self_marked boolean not null default false,
  add column confirmed_at timestamptz,
  add column confirmed_by uuid references auth.users (id) on delete set null;
update public.attendance set confirmed_at = created_at, confirmed_by = created_by where confirmed_at is null;

-- Staff marks are confirmed on the spot; confirming a self check-in stamps who did it.
create or replace function public.attendance_confirmation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.self_marked then
      new.confirmed_at := null;
      new.confirmed_by := null;
    else
      new.confirmed_at := coalesce(new.confirmed_at, now());
      new.confirmed_by := coalesce(auth.uid(), new.confirmed_by);
    end if;
  elsif new.confirmed_at is not null and old.confirmed_at is null then
    new.confirmed_by := coalesce(auth.uid(), new.confirmed_by);
  elsif new.confirmed_at is null then
    new.confirmed_by := null;
  end if;
  return new;
end;
$$;

create trigger attendance_confirmation before insert or update on public.attendance
  for each row execute function public.attendance_confirmation();

-- Staff may confirm (update) attendance; self_marked can only be set through check_in().
create policy attendance_update on public.attendance for update to authenticated
  using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
-- Direct inserts by staff can't fake a self check-in (the RPC runs as definer and bypasses this policy).
drop policy attendance_insert on public.attendance;
create policy attendance_insert on public.attendance for insert to authenticated
  with check (public.is_school_member(school_id) and not self_marked);

-- A student marks themself present in a class that is scheduled today (Chile time).
create or replace function public.check_in(p_class_id uuid)
returns public.attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  cls record;
  sid uuid;
  today date := (now() at time zone 'America/Santiago')::date;
  row public.attendance;
begin
  select id, school_id, active into cls from public.classes where id = p_class_id;
  if not found or not cls.active then raise exception 'class not available'; end if;
  select id into sid from public.students where school_id = cls.school_id and user_id = auth.uid() and active;
  if sid is null then raise exception 'not a student of this school'; end if;
  if not exists (select 1 from public.class_schedules where class_id = cls.id and weekday = extract(isodow from today)) then
    raise exception 'class is not scheduled today';
  end if;
  insert into public.attendance (school_id, class_id, student_id, date, self_marked)
  values (cls.school_id, cls.id, sid, today, true)
  on conflict (class_id, student_id, date) do nothing;
  select * into row from public.attendance where class_id = cls.id and student_id = sid and date = today;
  return row;
end;
$$;

-- Undo a self check-in that staff hasn't confirmed yet.
create or replace function public.undo_check_in(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.attendance a
  where a.class_id = p_class_id and a.date = (now() at time zone 'America/Santiago')::date
    and a.confirmed_at is null and a.student_id in (select public.my_student_ids());
end;
$$;

-- 5. XP and skills -----------------------------------------------------------------------------------------
-- 10 XP per confirmed attendance; level = xp / 100 + 1. Skills = XP per class tag.
create or replace function public.student_progress(p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  st record;
  xp integer;
  skills jsonb;
begin
  select id, school_id, user_id into st from public.students where id = p_student_id;
  if not found then return null; end if;
  if not (public.is_school_member(st.school_id) or coalesce(st.user_id = auth.uid(), false)) then
    raise exception 'not allowed';
  end if;
  select 10 * count(*) into xp from public.attendance where student_id = st.id and confirmed_at is not null;
  select coalesce(jsonb_agg(jsonb_build_object('tag_id', t.id, 'label', t.label, 'icon', t.icon, 'xp', s.xp) order by s.xp desc, t.label), '[]'::jsonb)
    into skills
    from (
      select ct.tag_id, 10 * count(*) as xp
      from public.attendance a join public.class_tags ct on ct.class_id = a.class_id
      where a.student_id = st.id and a.confirmed_at is not null
      group by ct.tag_id
    ) s join public.tags t on t.id = s.tag_id;
  return jsonb_build_object(
    'xp', xp, 'level', xp / 100 + 1, 'level_xp', xp % 100, 'next_level_xp', 100,
    'attended', xp / 10,
    'pending', (select count(*) from public.attendance where student_id = st.id and confirmed_at is null),
    'skills', skills
  );
end;
$$;

revoke execute on function public.check_in(uuid), public.undo_check_in(uuid), public.student_progress(uuid) from public, anon;
grant execute on function public.check_in(uuid), public.undo_check_in(uuid), public.student_progress(uuid) to authenticated;
revoke execute on function public.my_student_ids() from public, anon;
grant execute on function public.my_student_ids(), public.is_student_user(uuid) to authenticated;
