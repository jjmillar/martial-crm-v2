-- Trial bookings no longer create a task in Tareas: they show up in Asistencia, on the card of the class and date
-- that was booked (with the visitor's details). The automatic trial tasks already created are removed (the bookings
-- themselves keep all their data).

delete from public.tasks where kind = 'clase_prueba';

create or replace function public.book_trial(
  p_slug text, p_schedule_id uuid, p_date date, p_name text, p_phone text, p_email text default null, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.schools;
  cs public.class_schedules;
  c public.classes;
  local_now timestamp := now() at time zone 'America/Santiago';
  today date := (now() at time zone 'America/Santiago')::date;
  bid uuid;
  mail text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  select * into s from public.schools where slug = p_slug and landing_enabled and trial_enabled;
  if not found then raise exception 'trial booking not available'; end if;
  select * into cs from public.class_schedules where id = p_schedule_id and school_id = s.id;
  if not found then raise exception 'slot not available'; end if;
  select * into c from public.classes where id = cs.class_id and active;
  if not found then raise exception 'slot not available'; end if;
  if p_date is null or p_date < today or p_date > today + 21 or extract(isodow from p_date) <> cs.weekday then
    raise exception 'date not available';
  end if;
  if p_date + cs.start_time < local_now + make_interval(hours => s.trial_min_hours) then
    raise exception 'too late to book';
  end if;
  -- Light abuse guard: the same phone can hold at most 2 upcoming bookings per school.
  if (select count(*) from public.trial_bookings
      where school_id = s.id and status = 'agendada' and date >= today
        and regexp_replace(phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')) >= 2 then
    raise exception 'too many bookings';
  end if;

  insert into public.trial_bookings (school_id, class_id, schedule_id, class_name, date, start_time, end_time, name, phone, email, notes)
  values (s.id, c.id, cs.id, c.name, p_date, cs.start_time, cs.end_time, btrim(p_name), btrim(p_phone), mail, nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into bid;

  return bid;
end;
$$;
revoke execute on function public.book_trial(text, uuid, date, text, text, text, text) from public;
grant execute on function public.book_trial(text, uuid, date, text, text, text, text) to anon, authenticated;
