-- Check-in by QR (2026-11-25): the school prints a QR (its own code) and sticks it in the room. A signed-in student
-- who opens the link gets today's class marked and CONFIRMED on the spot (being in the room is the proof), from
-- 1 hour before the class starts until it ends (Chile time). The school can generate a new code at any time: the
-- old one stops working (a printed QR can be photographed and shared).

-- 1. The school's code: only its CEO/admins can read it; changed only through rotate_check_in_code().
create table public.school_check_in_codes (
  school_id uuid primary key references public.schools (id) on delete cascade,
  token text not null unique check (token ~ '^[0-9a-f]{32}$'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
alter table public.school_check_in_codes enable row level security;
create policy school_check_in_codes_select on public.school_check_in_codes for select to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
-- No insert/update/delete policies: writes only through the definer function below.

create or replace function public.rotate_check_in_code(p_school_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare t text := replace(gen_random_uuid()::text, '-', ''); -- 122 random bits
begin
  if p_school_id is null or not public.has_school_role(p_school_id, array['admin']::public.school_role[]) then
    raise exception 'not allowed';
  end if;
  insert into public.school_check_in_codes as c (school_id, token, created_by) values (p_school_id, t, auth.uid())
  on conflict (school_id) do update set token = excluded.token, created_at = now(), created_by = excluded.created_by;
  perform public.audit(p_school_id, 'check_in_code_rotated', 'school_check_in_codes', p_school_id, '{}'::jsonb);
  return t;
end;
$$;

-- 2. Attendance remembers it came from the QR.
alter table public.attendance add column by_qr boolean not null default false;

-- The QR opens 1 hour before the class; every other way still waits for the start (marker set only by qr_check_in).
create or replace function public.attendance_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.class_started(new.class_id, new.date)
     and coalesce(current_setting('mcrm.qr_check_in', true), '') <> 'on' then
    raise exception 'class not started';
  end if;
  return new;
end;
$$;
revoke execute on function public.attendance_window() from public, anon, authenticated;

-- 3. Scan: today's class whose window (start − 1 h … end) contains now. With several people on the account
-- (guardian + children) and no p_student_id, it answers with the choice instead of guessing.
create or replace function public.qr_check_in(p_token text, p_student_id uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  sc uuid;
  now_ts timestamp := now() at time zone 'America/Santiago';
  today date := (now() at time zone 'America/Santiago')::date;
  people jsonb;
  sid uuid;
  sname text;
  pick record;
  nxt record;
  a public.attendance;
  already boolean := false;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  if not public.rate_limit_hit('qr_check_in', auth.uid()::text, 30, 3600) then return jsonb_build_object('error', 'too_many'); end if;
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then return jsonb_build_object('error', 'invalid_code'); end if;
  select school_id into sc from public.school_check_in_codes where token = p_token;
  if sc is null then return jsonb_build_object('error', 'invalid_code'); end if;

  -- Who can be checked in from this account at this school (own record and children, active).
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.full_name) order by s.full_name), '[]'::jsonb) into people
  from public.students s where s.school_id = sc and s.active and s.id in (select public.my_student_ids());
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

  -- Today's blocks: the session if the class has one today (and it is held), otherwise its weekly schedule.
  with blocks as (
    select c.id class_id, c.name, se.start_time, se.end_time
    from public.class_sessions se join public.classes c on c.id = se.class_id
    where se.school_id = sc and se.date = today and not se.not_held and c.active
    union all
    select c.id, c.name, cs.start_time, cs.end_time
    from public.class_schedules cs join public.classes c on c.id = cs.class_id
    where cs.school_id = sc and cs.weekday = extract(isodow from today) and c.active
      and not exists (select 1 from public.class_sessions se where se.class_id = c.id and se.date = today)
  )
  select * into pick from blocks
  where now_ts between (today + start_time) - interval '1 hour' and (today + end_time)
  order by abs(extract(epoch from (now_ts - (today + start_time)))) limit 1;

  if not found then
    with blocks as (
      select c.name, se.start_time from public.class_sessions se join public.classes c on c.id = se.class_id
      where se.school_id = sc and se.date = today and not se.not_held and c.active
      union all
      select c.name, cs.start_time from public.class_schedules cs join public.classes c on c.id = cs.class_id
      where cs.school_id = sc and cs.weekday = extract(isodow from today) and c.active
        and not exists (select 1 from public.class_sessions se where se.class_id = c.id and se.date = today)
    )
    select * into nxt from blocks where (today + start_time) > now_ts order by start_time limit 1;
    return jsonb_build_object('error', 'no_class', 'student', sname,
      'next', case when nxt is null then null else jsonb_build_object('name', nxt.name, 'start', to_char(nxt.start_time, 'HH24:MI')) end);
  end if;

  select * into a from public.attendance where class_id = pick.class_id and student_id = sid and date = today;
  if found then
    already := a.confirmed_at is not null;
    if not already then update public.attendance set confirmed_at = now(), by_qr = true where id = a.id; end if;
  else
    perform set_config('mcrm.qr_check_in', 'on', true);
    insert into public.attendance (school_id, class_id, student_id, date, self_marked, marked_by, by_qr)
    values (sc, pick.class_id, sid, today, true, auth.uid(), true)
    returning * into a;
    perform set_config('mcrm.qr_check_in', '', true);
    update public.attendance set confirmed_at = now() where id = a.id; -- attendance_confirmation stamps who
  end if;

  return jsonb_build_object('ok', true, 'already', already, 'student', sname, 'class', pick.name,
    'start', to_char(pick.start_time, 'HH24:MI'), 'end', to_char(pick.end_time, 'HH24:MI'), 'date', today);
end;
$$;

revoke execute on function public.rotate_check_in_code(uuid) from public, anon;
revoke execute on function public.qr_check_in(text, uuid) from public, anon;
grant execute on function public.rotate_check_in_code(uuid) to authenticated;
grant execute on function public.qr_check_in(text, uuid) to authenticated;
grant select on public.school_check_in_codes to authenticated;
