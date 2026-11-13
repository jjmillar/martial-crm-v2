-- Free trial class booking from the public landing page, and a simple per-school task board ("Tareas")
-- that centralizes trial bookings (as automatic tasks) with tasks the staff create themselves.

-- 1. Trial booking settings and weekly slots ------------------------------------------------------
alter table public.schools
  add column trial_enabled boolean not null default false,
  add column trial_note text check (trial_note is null or length(trial_note) <= 300);

create table public.trial_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  capacity smallint not null default 2 check (capacity between 1 and 50),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index trial_slots_school_idx on public.trial_slots (school_id, weekday, start_time);
create trigger trial_slots_school_fixed before update on public.trial_slots
  for each row execute function public.prevent_school_change();

alter table public.trial_slots enable row level security;
create policy trial_slots_select on public.trial_slots for select to authenticated using (public.is_school_member(school_id));
create policy trial_slots_insert on public.trial_slots for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy trial_slots_update on public.trial_slots for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy trial_slots_delete on public.trial_slots for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

create table public.trial_bookings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  slot_id uuid references public.trial_slots (id) on delete set null,
  date date not null,
  start_time time not null,
  end_time time not null,
  name text not null check (length(btrim(name)) between 2 and 80),
  phone text not null check (length(btrim(phone)) between 6 and 30),
  email text check (email is null or (length(email) <= 120 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  notes text check (notes is null or length(notes) <= 300),
  status text not null default 'agendada' check (status in ('agendada', 'cancelada')),
  created_at timestamptz not null default now()
);
create index trial_bookings_school_idx on public.trial_bookings (school_id, date);
create index trial_bookings_slot_idx on public.trial_bookings (slot_id, date) where status = 'agendada';
create trigger trial_bookings_school_fixed before update on public.trial_bookings
  for each row execute function public.prevent_school_change();

-- Visitors book through book_trial(); staff read and cancel.
alter table public.trial_bookings enable row level security;
create policy trial_bookings_select on public.trial_bookings for select to authenticated using (public.is_school_member(school_id));
create policy trial_bookings_update on public.trial_bookings for update to authenticated
  using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy trial_bookings_delete on public.trial_bookings for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

-- 2. Tasks (kanban: por hacer → en curso → hecho) ---------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 140),
  notes text check (notes is null or length(notes) <= 2000),
  status text not null default 'por_hacer' check (status in ('por_hacer', 'en_curso', 'hecho')),
  kind text not null default 'manual' check (kind in ('manual', 'clase_prueba')),
  trial_booking_id uuid references public.trial_bookings (id) on delete set null,
  position double precision not null default extract(epoch from clock_timestamp()),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_school_idx on public.tasks (school_id, status, position);
create trigger tasks_school_fixed before update on public.tasks
  for each row execute function public.prevent_school_change();

create or replace function public.touch_task()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_task();

alter table public.tasks enable row level security;
create policy tasks_select on public.tasks for select to authenticated using (public.is_school_member(school_id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_school_member(school_id) and kind = 'manual');
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy tasks_delete on public.tasks for delete to authenticated using (public.is_school_member(school_id));

-- 3. Public booking -----------------------------------------------------------------------------------
-- Upcoming bookable dates for a school's active slots (next 21 days, from tomorrow), with free places.
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
  cross join lateral (
    select g::date as day
    from generate_series((now() at time zone 'America/Santiago')::date + 1,
                         (now() at time zone 'America/Santiago')::date + 21, interval '1 day') g
  ) d
  where ts.school_id = p_school_id and ts.active and extract(isodow from d.day) = ts.weekday;
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
  today date := (now() at time zone 'America/Santiago')::date;
  taken int;
  bid uuid;
  mail text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  select * into s from public.schools where slug = p_slug and landing_enabled and trial_enabled;
  if not found then raise exception 'trial booking not available'; end if;
  select * into ts from public.trial_slots where id = p_slot_id and school_id = s.id and active;
  if not found then raise exception 'slot not available'; end if;
  if p_date is null or p_date <= today or p_date > today + 21 or extract(isodow from p_date) <> ts.weekday then
    raise exception 'date not available';
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

-- 4. Landing payload: add the trial booking block (only when enabled) ---------------------------------
create or replace function public.school_landing(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id, 'slug', s.slug, 'name', s.name, 'logo_url', s.logo_url, 'city', s.city, 'address', s.address,
    'phone', s.phone, 'email', s.email, 'description', s.description,
    'theme', s.landing_theme, 'primary', s.landing_primary, 'accent', s.landing_accent,
    'tagline', s.landing_tagline, 'about', s.landing_about,
    'instagram', s.landing_instagram, 'whatsapp', s.landing_whatsapp,
    'enrollment_fee', s.enrollment_fee,
    'photos', coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'caption', p.caption) order by p.position, p.created_at)
                        from public.school_photos p where p.school_id = s.id), '[]'::jsonb),
    'schedule', case when s.landing_show_schedule then coalesce((
        select jsonb_agg(jsonb_build_object('weekday', cs.weekday, 'start', cs.start_time, 'end', cs.end_time,
                                            'name', c.name, 'color', c.color, 'level', c.level, 'discipline', sp.name)
                         order by cs.weekday, cs.start_time)
        from public.class_schedules cs
        join public.classes c on c.id = cs.class_id and c.active
        left join public.specialties sp on sp.id = c.specialty_id
        where cs.school_id = s.id), '[]'::jsonb) else null end,
    'plans', case when s.landing_show_plans then coalesce((
        select jsonb_agg(jsonb_build_object('name', pl.name, 'price', pl.price, 'cycle', pl.billing_cycle,
                                            'description', pl.description, 'trial', pl.is_trial)
                         order by pl.is_trial desc, pl.price)
        from public.plans pl where pl.school_id = s.id and pl.active), '[]'::jsonb) else null end,
    'trial', case when s.trial_enabled then jsonb_build_object('note', s.trial_note, 'slots', public.trial_availability(s.id)) else null end
  )
  from public.schools s
  where s.slug = p_slug and s.landing_enabled;
$$;
grant execute on function public.school_landing(text) to anon, authenticated;
