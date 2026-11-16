-- Every class that takes place is stored as its own record (class_sessions): a correlative number per school (in
-- date order), and a snapshot of the class for that date (name, time, teacher, room, description, skills).
--   * Sessions up to today are created automatically (when Asistencia opens and every night), numbered in order of
--     date and start time. Past sessions never change when the class is edited later (history).
--   * Editing a class (Clases) updates its sessions from today on, unless a session was edited on its own.
--   * Editing a session (its card in Asistencia) changes only that record; a future one is created then and gets its
--     number when its day comes.
--   * Attendance stays by class and date; XP per skill now uses the skills the session had that day.

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  number integer,
  class_id uuid not null,
  schedule_id uuid references public.class_schedules (id) on delete set null,
  date date not null,
  start_time time not null,
  end_time time not null,
  name text not null check (length(btrim(name)) between 1 and 80),
  description text check (description is null or length(description) <= 300),
  teacher_id uuid references public.teachers (id) on delete set null,
  room text check (room is null or length(room) <= 60),
  color text not null default '#e0492c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  skill_ids uuid[] not null default '{}',
  customized boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (class_id, school_id) references public.classes (id, school_id) on delete cascade,
  unique (class_id, date, start_time),
  unique (school_id, number),
  check (end_time > start_time)
);
create index class_sessions_school_date_idx on public.class_sessions (school_id, date, start_time);
create trigger class_sessions_set_updated_at before update on public.class_sessions
  for each row execute function public.set_updated_at();
create trigger class_sessions_school_fixed before update on public.class_sessions
  for each row execute function public.prevent_school_change();

alter table public.class_sessions enable row level security;
create policy class_sessions_select on public.class_sessions for select to authenticated using (public.is_school_member(school_id));
-- Writes go through the functions below (numbering and snapshots must stay consistent).

-- Snapshot of a class for one occurrence.
create or replace function public.class_snapshot_skills(p_class_id uuid)
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(tag_id order by tag_id), '{}') from public.class_tags where class_id = p_class_id;
$$;

-- Creates the missing sessions of a school up to today and numbers every session whose day has come, in date order.
create or replace function public.sync_class_sessions(p_school_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Santiago')::date;
  since date;
  next_no integer;
  r record;
  n integer := 0;
begin
  if auth.uid() is not null and not public.is_school_member(p_school_id) then raise exception 'not allowed'; end if;
  -- one sync per school at a time (numbers must not collide)
  perform pg_advisory_xact_lock(hashtext('class_sessions:' || p_school_id::text));

  -- From the day after the last generated session (or since the school's first class) up to today.
  select coalesce(
           (select max(date) from public.class_sessions where school_id = p_school_id and number is not null),
           (select least(min(c.created_at at time zone 'America/Santiago')::date,
                         coalesce((select min(a.date) from public.attendance a where a.school_id = p_school_id), today))
              from public.classes c where c.school_id = p_school_id))
    into since;
  if since is null then return 0; end if;

  insert into public.class_sessions (school_id, class_id, schedule_id, date, start_time, end_time, name, description, teacher_id, room, color, skill_ids)
  select c.school_id, c.id, cs.id, d.day, cs.start_time, cs.end_time, c.name, c.description, c.teacher_id, c.room, c.color, public.class_snapshot_skills(c.id)
  from public.classes c
  join public.class_schedules cs on cs.class_id = c.id
  cross join lateral (select g::date as day from generate_series(since, today, interval '1 day') g) d
  where c.school_id = p_school_id and c.active
    and extract(isodow from d.day) = cs.weekday
    and d.day >= (c.created_at at time zone 'America/Santiago')::date
  on conflict (class_id, date, start_time) do nothing;

  -- Attendance taken on a day with no session (e.g. an extra class): it still becomes a session.
  insert into public.class_sessions (school_id, class_id, date, start_time, end_time, name, description, teacher_id, room, color, skill_ids)
  select distinct on (a.class_id, a.date) c.school_id, c.id, a.date, '00:00', '00:01', c.name, c.description, c.teacher_id, c.room, c.color, public.class_snapshot_skills(c.id)
  from public.attendance a join public.classes c on c.id = a.class_id
  where a.school_id = p_school_id and a.date >= since and a.date <= today
    and not exists (select 1 from public.class_sessions s where s.class_id = a.class_id and s.date = a.date)
  on conflict (class_id, date, start_time) do nothing;

  -- Number every session whose day has come, continuing the school's sequence in date / time order.
  select coalesce(max(number), 0) into next_no from public.class_sessions where school_id = p_school_id;
  for r in
    select id from public.class_sessions
    where school_id = p_school_id and number is null and date <= today
    order by date, start_time, name, id
  loop
    next_no := next_no + 1;
    update public.class_sessions set number = next_no where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.sync_class_sessions(uuid) from public, anon;
grant execute on function public.sync_class_sessions(uuid) to authenticated;

create or replace function public.sync_all_class_sessions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare s record;
begin
  for s in select id from public.schools loop
    perform public.sync_class_sessions(s.id);
  end loop;
end;
$$;
revoke execute on function public.sync_all_class_sessions() from public, anon, authenticated;

-- Save the card of one class on one date (admins): description and skills of that session only.
create or replace function public.save_class_session(
  p_class_id uuid, p_date date, p_start_time time, p_description text, p_skill_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.classes;
  cs public.class_schedules;
  sid uuid;
  skills uuid[];
begin
  select * into c from public.classes where id = p_class_id;
  if not found or not public.has_school_role(c.school_id, array['admin']::public.school_role[]) then raise exception 'not allowed'; end if;
  if p_description is not null and length(p_description) > 300 then raise exception 'description too long'; end if;
  -- only this school's skills
  select coalesce(array_agg(t.id order by t.id), '{}') into skills from public.tags t where t.school_id = c.school_id and t.id = any(coalesce(p_skill_ids, '{}'));
  select * into cs from public.class_schedules where class_id = c.id and weekday = extract(isodow from p_date) and start_time = p_start_time limit 1;

  insert into public.class_sessions (school_id, class_id, schedule_id, date, start_time, end_time, name, description, teacher_id, room, color, skill_ids, customized)
  values (c.school_id, c.id, cs.id, p_date, p_start_time, coalesce(cs.end_time, p_start_time + interval '1 hour'), c.name,
          nullif(btrim(coalesce(p_description, '')), ''), c.teacher_id, c.room, c.color, skills, true)
  on conflict (class_id, date, start_time) do update
    set description = excluded.description, skill_ids = excluded.skill_ids, customized = true
  returning id into sid;
  return sid;
end;
$$;
revoke execute on function public.save_class_session(uuid, date, time, text, uuid[]) from public, anon;
grant execute on function public.save_class_session(uuid, date, time, text, uuid[]) to authenticated;

-- Editing a class updates its sessions from today on (not the past, not sessions edited on their own).
create or replace function public.class_to_sessions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.class_sessions
     set name = new.name, description = new.description, teacher_id = new.teacher_id, room = new.room, color = new.color
   where class_id = new.id and not customized and date >= (now() at time zone 'America/Santiago')::date;
  return null;
end;
$$;
create trigger classes_to_sessions after update of name, description, teacher_id, room, color on public.classes
  for each row execute function public.class_to_sessions();

create or replace function public.class_tags_to_sessions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare cid uuid := coalesce(new.class_id, old.class_id);
begin
  update public.class_sessions
     set skill_ids = public.class_snapshot_skills(cid)
   where class_id = cid and not customized and date >= (now() at time zone 'America/Santiago')::date;
  return null;
end;
$$;
create trigger class_tags_to_sessions after insert or delete on public.class_tags
  for each row execute function public.class_tags_to_sessions();

-- XP per skill: the skills the session had that day (falls back to the class's skills when there is no session).
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
      select x.tag_id, 10 * count(*) as xp
      from (
        select a.id, unnest(coalesce(
                 (select se.skill_ids from public.class_sessions se where se.class_id = a.class_id and se.date = a.date order by se.start_time limit 1),
                 public.class_snapshot_skills(a.class_id))) as tag_id
        from public.attendance a
        where a.student_id = st.id and a.confirmed_at is not null
      ) x
      group by x.tag_id
    ) s join public.tags t on t.id = s.tag_id;
  return jsonb_build_object(
    'xp', xp, 'level', xp / 100 + 1, 'level_xp', xp % 100, 'next_level_xp', 100,
    'attended', xp / 10,
    'pending', (select count(*) from public.attendance where student_id = st.id and confirmed_at is null),
    'skills', skills
  );
end;
$$;

-- Backfill: every school's sessions so far.
select public.sync_all_class_sessions();
