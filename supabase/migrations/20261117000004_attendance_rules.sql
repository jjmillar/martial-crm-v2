-- Attendance rules (2026-11-17):
--  1. Attendance can only be recorded once the class has started (Chile time), from anywhere: staff marking,
--     a student's own check-in, or a direct API call. Past classes can still be recorded.
--  2. A student's check-in is a request: the school's team approves it (confirmed_at/confirmed_by, kept on the
--     record for analytics) or rejects it (removed and written to the audit log).

-- Has this class started on that date? Earlier dates: yes; later dates: no; today: from its start time.
create or replace function public.class_started(p_class_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_date < (now() at time zone 'America/Santiago')::date then true
    when p_date > (now() at time zone 'America/Santiago')::date then false
    else exists (
      select 1 from public.class_schedules cs
      where cs.class_id = p_class_id and cs.weekday = extract(isodow from p_date)
        and cs.start_time <= (now() at time zone 'America/Santiago')::time
    ) or exists (
      select 1 from public.class_sessions s
      where s.class_id = p_class_id and s.date = p_date and s.start_time <= (now() at time zone 'America/Santiago')::time
    )
  end;
$$;
grant execute on function public.class_started(uuid, date) to authenticated;

create or replace function public.attendance_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Requests from the app (a signed-in user). Maintenance by the service role is not limited.
  if auth.uid() is not null and not public.class_started(new.class_id, new.date) then
    raise exception 'class not started';
  end if;
  return new;
end;
$$;
create trigger attendance_window before insert on public.attendance
  for each row execute function public.attendance_window();

-- Approve or reject students' own check-ins (the team of that school).
create or replace function public.review_attendance(p_ids uuid[], p_approve boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.attendance;
  n integer := 0;
begin
  for a in select * from public.attendance where id = any(p_ids) and confirmed_at is null loop
    if not public.is_school_member(a.school_id) then raise exception 'not allowed'; end if;
    if p_approve then
      update public.attendance set confirmed_at = now() where id = a.id; -- attendance_confirmation stamps who
    else
      perform public.audit(a.school_id, 'attendance_rejected', 'attendance', a.id,
        jsonb_build_object('student_id', a.student_id, 'class_id', a.class_id, 'date', a.date));
      delete from public.attendance where id = a.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.review_attendance(uuid[], boolean) from public, anon;
grant execute on function public.review_attendance(uuid[], boolean) to authenticated;

revoke execute on function public.attendance_window() from public, anon, authenticated;
