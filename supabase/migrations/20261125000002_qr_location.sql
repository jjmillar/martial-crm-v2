-- QR check-in + location (2026-11-25): the school's coordinates come from its own address (geocoded by the app when
-- the address is saved; nothing to configure). Scanning within 150 m of the school confirms the attendance as
-- before; farther away, or without the phone's location, it becomes a pending request the team approves.
-- Only the distance (meters) is stored, never the student's coordinates.

alter table public.schools
  add column geo_lat double precision check (geo_lat between -90 and 90),
  add column geo_lng double precision check (geo_lng between -180 and 180),
  add column geo_address text check (geo_address is null or length(geo_address) <= 400),
  add constraint schools_geo_pair check ((geo_lat is null) = (geo_lng is null));

-- Coordinates follow the address: changing the address or city without new coordinates clears the old ones.
create or replace function public.schools_geo_follow_address()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (new.address is distinct from old.address or new.city is distinct from old.city)
     and new.geo_lat is not distinct from old.geo_lat and new.geo_lng is not distinct from old.geo_lng then
    new.geo_lat := null;
    new.geo_lng := null;
    new.geo_address := null;
  end if;
  return new;
end;
$$;
create trigger schools_geo_follow_address before update on public.schools
  for each row execute function public.schools_geo_follow_address();
revoke execute on function public.schools_geo_follow_address() from public, anon, authenticated;

alter table public.attendance add column qr_distance_m integer check (qr_distance_m is null or qr_distance_m >= 0);

-- Great-circle distance in meters (haversine).
create or replace function public.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = ''
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

drop function public.qr_check_in(text, uuid);

create or replace function public.qr_check_in(
  p_token text, p_student_id uuid default null, p_lat double precision default null, p_lng double precision default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  RADIUS constant integer := 150;
  sc record;
  now_ts timestamp := now() at time zone 'America/Santiago';
  today date := (now() at time zone 'America/Santiago')::date;
  people jsonb;
  sid uuid;
  sname text;
  pick record;
  nxt record;
  a public.attendance;
  dist integer;
  inside boolean;
  reason text;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  if not public.rate_limit_hit('qr_check_in', auth.uid()::text, 30, 3600) then return jsonb_build_object('error', 'too_many'); end if;
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then return jsonb_build_object('error', 'invalid_code'); end if;
  select s.id, s.geo_lat, s.geo_lng into sc
  from public.school_check_in_codes c join public.schools s on s.id = c.school_id where c.token = p_token;
  if not found then return jsonb_build_object('error', 'invalid_code'); end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.full_name) order by s.full_name), '[]'::jsonb) into people
  from public.students s where s.school_id = sc.id and s.active and s.id in (select public.my_student_ids());
  if jsonb_array_length(people) = 0 then return jsonb_build_object('error', 'not_student'); end if;
  if p_student_id is not null then
    if not people @> jsonb_build_array(jsonb_build_object('id', p_student_id)) then return jsonb_build_object('error', 'not_student'); end if;
    sid := p_student_id;
  elsif jsonb_array_length(people) = 1 then
    sid := (people -> 0 ->> 'id')::uuid;
  else
    return jsonb_build_object('choose', people);
  end if;
  select full_name into sname from public.students where id = sid;

  with blocks as (
    select c.id class_id, c.name, se.start_time, se.end_time
    from public.class_sessions se join public.classes c on c.id = se.class_id
    where se.school_id = sc.id and se.date = today and not se.not_held and c.active
    union all
    select c.id, c.name, cs.start_time, cs.end_time
    from public.class_schedules cs join public.classes c on c.id = cs.class_id
    where cs.school_id = sc.id and cs.weekday = extract(isodow from today) and c.active
      and not exists (select 1 from public.class_sessions se where se.class_id = c.id and se.date = today)
  )
  select * into pick from blocks
  where now_ts between (today + start_time) - interval '1 hour' and (today + end_time)
  order by abs(extract(epoch from (now_ts - (today + start_time)))) limit 1;

  if not found then
    with blocks as (
      select c.name, se.start_time from public.class_sessions se join public.classes c on c.id = se.class_id
      where se.school_id = sc.id and se.date = today and not se.not_held and c.active
      union all
      select c.name, cs.start_time from public.class_schedules cs join public.classes c on c.id = cs.class_id
      where cs.school_id = sc.id and cs.weekday = extract(isodow from today) and c.active
        and not exists (select 1 from public.class_sessions se where se.class_id = c.id and se.date = today)
    )
    select * into nxt from blocks where (today + start_time) > now_ts order by start_time limit 1;
    return jsonb_build_object('error', 'no_class', 'student', sname,
      'next', case when nxt is null then null else jsonb_build_object('name', nxt.name, 'start', to_char(nxt.start_time, 'HH24:MI')) end);
  end if;

  -- Location: without the school's coordinates the check can't run (confirmed as before; Ajustes warns about it).
  if p_lat is not null and p_lng is not null and p_lat between -90 and 90 and p_lng between -180 and 180 and sc.geo_lat is not null then
    dist := round(public.distance_m(sc.geo_lat, sc.geo_lng, p_lat, p_lng));
  end if;
  if sc.geo_lat is null then
    inside := true;
  elsif dist is null then
    inside := false; reason := 'no_location';
  else
    inside := dist <= RADIUS;
    if not inside then reason := 'far'; end if;
  end if;

  select * into a from public.attendance where class_id = pick.class_id and student_id = sid and date = today;
  if found and a.confirmed_at is not null then
    return jsonb_build_object('ok', true, 'already', true, 'student', sname, 'class', pick.name,
      'start', to_char(pick.start_time, 'HH24:MI'), 'end', to_char(pick.end_time, 'HH24:MI'), 'date', today);
  end if;
  if not found then
    perform set_config('mcrm.qr_check_in', 'on', true);
    insert into public.attendance (school_id, class_id, student_id, date, self_marked, marked_by, by_qr, qr_distance_m)
    values (sc.id, pick.class_id, sid, today, true, auth.uid(), true, dist)
    returning * into a;
    perform set_config('mcrm.qr_check_in', '', true);
  else
    update public.attendance set by_qr = true, qr_distance_m = coalesce(dist, qr_distance_m) where id = a.id;
  end if;
  if inside then
    update public.attendance set confirmed_at = now() where id = a.id; -- attendance_confirmation stamps who
  end if;

  return jsonb_build_object('ok', inside, 'pending', not inside, 'reason', reason, 'distance', dist, 'already', false,
    'student', sname, 'class', pick.name, 'start', to_char(pick.start_time, 'HH24:MI'), 'end', to_char(pick.end_time, 'HH24:MI'), 'date', today);
end;
$$;

revoke execute on function public.qr_check_in(text, uuid, double precision, double precision) from public, anon;
grant execute on function public.qr_check_in(text, uuid, double precision, double precision) to authenticated;
revoke execute on function public.distance_m(double precision, double precision, double precision, double precision) from public, anon, authenticated;
