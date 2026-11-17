-- Students can also mark attendance for a recent class they forgot (up to 7 days back), not only today's.
-- It is still a request (self_marked, pending) that the team approves; nothing before the class has started.

create or replace function public.check_in_on(p_class_id uuid, p_date date)
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
  select id into sid from public.students where school_id = cls.school_id and user_id = auth.uid() and active and public.mfa_ok();
  if sid is null then raise exception 'not a student of this school'; end if;
  if p_date is null or p_date > today or p_date < today - 7 then raise exception 'date out of range'; end if;
  if not exists (select 1 from public.class_schedules where class_id = cls.id and weekday = extract(isodow from p_date))
     and not exists (select 1 from public.class_sessions where class_id = cls.id and date = p_date) then
    raise exception 'class is not scheduled that day';
  end if;
  insert into public.attendance (school_id, class_id, student_id, date, self_marked)
  values (cls.school_id, cls.id, sid, p_date, true)
  on conflict (class_id, student_id, date) do nothing;  -- attendance_window: only once the class has started
  select * into row from public.attendance where class_id = cls.id and student_id = sid and date = p_date;
  return row;
end;
$$;

-- Today's check-in is the same thing for today (kept for existing callers).
create or replace function public.check_in(p_class_id uuid)
returns public.attendance
language sql
security definer
set search_path = ''
as $$ select public.check_in_on(p_class_id, (now() at time zone 'America/Santiago')::date); $$;

-- Undo a check-in the team hasn't approved yet, for that date.
create or replace function public.undo_check_in_on(p_class_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.attendance a
  where a.class_id = p_class_id and a.date = p_date and a.confirmed_at is null and a.self_marked
    and a.student_id in (select public.my_student_ids());
end;
$$;

revoke execute on function public.check_in_on(uuid, date) from public, anon;
revoke execute on function public.undo_check_in_on(uuid, date) from public, anon;
grant execute on function public.check_in_on(uuid, date) to authenticated;
grant execute on function public.undo_check_in_on(uuid, date) to authenticated;
