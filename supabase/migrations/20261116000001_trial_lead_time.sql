-- Free trial class: minimum notice (hours) the school needs, set in Ajustes → Agendamiento.
-- A slot is offered (and bookable) only if it starts at least that many hours from now (Chile time).
-- The window still ends 21 days ahead; with 0 hours, later slots of today can be booked too.

alter table public.schools
  add column trial_min_hours smallint not null default 24 check (trial_min_hours between 0 and 168);

create or replace function public.trial_availability(p_school_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'slot_id', ts.id, 'date', d.day, 'start', ts.start_time, 'end', ts.end_time,
      'free', ts.capacity - (select count(*) from public.trial_bookings b
                             where b.slot_id = ts.id and b.date = d.day and b.status = 'agendada'))
    order by d.day, ts.start_time), '[]'::jsonb)
  from public.trial_slots ts
  join public.schools s on s.id = ts.school_id
  cross join lateral (
    select g::date as day
    from generate_series((now() at time zone 'America/Santiago')::date,
                         (now() at time zone 'America/Santiago')::date + 21, interval '1 day') g
  ) d
  where ts.school_id = p_school_id and ts.active and extract(isodow from d.day) = ts.weekday
    and d.day + ts.start_time >= (now() at time zone 'America/Santiago') + make_interval(hours => s.trial_min_hours);
$$;
revoke execute on function public.trial_availability(uuid) from public, anon, authenticated;

create or replace function public.book_trial(
  p_slug text, p_slot_id uuid, p_date date, p_name text, p_phone text, p_email text default null, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.schools;
  ts public.trial_slots;
  local_now timestamp := now() at time zone 'America/Santiago';
  today date := (now() at time zone 'America/Santiago')::date;
  taken int;
  bid uuid;
  mail text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  select * into s from public.schools where slug = p_slug and landing_enabled and trial_enabled;
  if not found then raise exception 'trial booking not available'; end if;
  select * into ts from public.trial_slots where id = p_slot_id and school_id = s.id and active;
  if not found then raise exception 'slot not available'; end if;
  if p_date is null or p_date < today or p_date > today + 21 or extract(isodow from p_date) <> ts.weekday then
    raise exception 'date not available';
  end if;
  if p_date + ts.start_time < local_now + make_interval(hours => s.trial_min_hours) then
    raise exception 'too late to book';
  end if;
  -- One place at a time per slot and date (serialize concurrent bookings of the same slot).
  perform pg_advisory_xact_lock(hashtext(p_slot_id::text || p_date::text));
  select count(*) into taken from public.trial_bookings where slot_id = ts.id and date = p_date and status = 'agendada';
  if taken >= ts.capacity then raise exception 'slot full'; end if;
  -- Light abuse guard: the same phone can hold at most 2 upcoming bookings per school.
  if (select count(*) from public.trial_bookings
      where school_id = s.id and status = 'agendada' and date >= today
        and regexp_replace(phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')) >= 2 then
    raise exception 'too many bookings';
  end if;

  insert into public.trial_bookings (school_id, slot_id, date, start_time, end_time, name, phone, email, notes)
  values (s.id, ts.id, p_date, ts.start_time, ts.end_time, btrim(p_name), btrim(p_phone), mail, nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into bid;

  insert into public.tasks (school_id, title, notes, kind, trial_booking_id, created_by)
  values (s.id,
          'Clase de prueba: ' || btrim(p_name) || ' · ' || to_char(p_date, 'DD/MM') || ' ' || to_char(ts.start_time, 'HH24:MI'),
          concat_ws(E'\n', 'Teléfono: ' || btrim(p_phone), 'Correo: ' || mail, 'Comentario: ' || nullif(btrim(coalesce(p_notes, '')), '')),
          'clase_prueba', bid, null);
  return bid;
end;
$$;
revoke execute on function public.book_trial(text, uuid, date, text, text, text, text) from public;
grant execute on function public.book_trial(text, uuid, date, text, text, text, text) to anon, authenticated;
