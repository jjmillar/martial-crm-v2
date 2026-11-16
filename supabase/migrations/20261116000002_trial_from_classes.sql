-- Free trial class booking now comes straight from the school's classes: every weekly block of an active class
-- is a bookable trial slot (class name, description, discipline, level and time), with unlimited places.
-- The manual trial_slots are no longer used (table kept, untouched, for the bookings already made with it).

alter table public.classes
  add column description text check (description is null or length(description) <= 300);

alter table public.trial_bookings
  add column class_id uuid references public.classes (id) on delete set null,
  add column schedule_id uuid references public.class_schedules (id) on delete set null,
  add column class_name text check (class_name is null or length(class_name) <= 80);

-- Upcoming class blocks a visitor can book: next 21 days, respecting the school's minimum notice.
create or replace function public.trial_availability(p_school_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'schedule_id', cs.id, 'class_id', c.id, 'date', d.day, 'start', cs.start_time, 'end', cs.end_time,
      'name', c.name, 'description', c.description, 'discipline', sp.name, 'level', c.level, 'color', c.color)
    order by d.day, cs.start_time, c.name), '[]'::jsonb)
  from public.class_schedules cs
  join public.classes c on c.id = cs.class_id and c.active
  join public.schools s on s.id = cs.school_id
  left join public.specialties sp on sp.id = c.specialty_id
  cross join lateral (
    select g::date as day
    from generate_series((now() at time zone 'America/Santiago')::date,
                         (now() at time zone 'America/Santiago')::date + 21, interval '1 day') g
  ) d
  where cs.school_id = p_school_id and extract(isodow from d.day) = cs.weekday
    and d.day + cs.start_time >= (now() at time zone 'America/Santiago') + make_interval(hours => s.trial_min_hours);
$$;
revoke execute on function public.trial_availability(uuid) from public, anon, authenticated;

drop function if exists public.book_trial(text, uuid, date, text, text, text, text);

create function public.book_trial(
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

  insert into public.tasks (school_id, title, notes, kind, trial_booking_id, created_by)
  values (s.id,
          left('Clase de prueba: ' || btrim(p_name) || ' · ' || c.name || ' · ' || to_char(p_date, 'DD/MM') || ' ' || to_char(cs.start_time, 'HH24:MI'), 140),
          concat_ws(E'\n', 'Teléfono: ' || btrim(p_phone), 'Correo: ' || mail, 'Comentario: ' || nullif(btrim(coalesce(p_notes, '')), '')),
          'clase_prueba', bid, null);
  return bid;
end;
$$;
revoke execute on function public.book_trial(text, uuid, date, text, text, text, text) from public;
grant execute on function public.book_trial(text, uuid, date, text, text, text, text) to anon, authenticated;
