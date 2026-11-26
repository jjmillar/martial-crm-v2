-- The school's martial arts (Ajustes → Artes marciales, school_arts) are now the CRM's only list of disciplines.
-- "Especialidades" (public.specialties, Ajustes → Catálogos) duplicated them: from here on a teacher's arts, a class's
-- art and a plan's art all point to school_arts.
-- 1. Each specialty is matched to the school's art with the same name (accents and case ignored; any "jiu-jitsu"/BJJ
--    name matches the school's BJJ art). A specialty in use without an equivalent art becomes an art of the school
--    (same name and active state, no belts) so no teacher, class or plan loses its discipline.
-- 2. classes.art_id and plans.art_id (same school enforced by composite FK; deleting the art leaves them as "all").
-- 3. teacher_arts replaces teacher_specialties; set_teacher_arts replaces set_teacher_specialties.
-- 4. The public landing and the trial booking read the discipline name from the art.
-- The old table, columns and function stay untouched (no longer used by the app) and are dropped in a later release.

create function pg_temp.norm(t text) returns text language sql immutable
  as $$ select regexp_replace(translate(lower(btrim(t)), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', '', 'g') $$;
create function pg_temp.is_bjj(t text) returns boolean language sql immutable
  as $$ select pg_temp.norm(t) like '%jiujitsu%' or pg_temp.norm(t) in ('bjj', 'jj') $$;

-- 1. Specialties in use with no equivalent art become arts.
insert into public.school_arts (school_id, name, position, active)
select sp.school_id, btrim(sp.name),
       coalesce((select max(a.position) from public.school_arts a where a.school_id = sp.school_id), 0) + 1, sp.active
from public.specialties sp
where (exists (select 1 from public.teacher_specialties t where t.specialty_id = sp.id)
       or exists (select 1 from public.classes c where c.specialty_id = sp.id)
       or exists (select 1 from public.plans p where p.specialty_id = sp.id))
  and not exists (
    select 1 from public.school_arts a
    where a.school_id = sp.school_id
      and (pg_temp.norm(a.name) = pg_temp.norm(sp.name) or (a.template_key = 'bjj' and pg_temp.is_bjj(sp.name))))
on conflict (school_id, name) do nothing;

create temporary table sp_art as
select sp.id as specialty_id, sp.school_id,
       (select a.id from public.school_arts a
        where a.school_id = sp.school_id
          and (pg_temp.norm(a.name) = pg_temp.norm(sp.name) or (a.template_key = 'bjj' and pg_temp.is_bjj(sp.name)))
        order by (pg_temp.norm(a.name) = pg_temp.norm(sp.name)) desc, a.active desc, a.position
        limit 1) as art_id
from public.specialties sp;

-- 2. Classes and plans point to the art.
alter table public.classes add column art_id uuid,
  add constraint classes_art_fkey foreign key (art_id, school_id) references public.school_arts (id, school_id) on delete set null (art_id);
alter table public.plans add column art_id uuid,
  add constraint plans_art_fkey foreign key (art_id, school_id) references public.school_arts (id, school_id) on delete set null (art_id);
create index classes_art_idx on public.classes (art_id) where art_id is not null;
create index plans_art_idx on public.plans (art_id) where art_id is not null;

update public.classes c set art_id = m.art_id from sp_art m where m.specialty_id = c.specialty_id and m.art_id is not null;
update public.plans p set art_id = m.art_id from sp_art m where m.specialty_id = p.specialty_id and m.art_id is not null;

-- 3. The arts a teacher teaches.
create table public.teacher_arts (
  teacher_id uuid not null,
  art_id uuid not null,
  school_id uuid not null references public.schools (id) on delete cascade,
  primary key (teacher_id, art_id),
  foreign key (teacher_id, school_id) references public.teachers (id, school_id) on delete cascade,
  foreign key (art_id, school_id) references public.school_arts (id, school_id) on delete cascade
);
create index teacher_arts_art_idx on public.teacher_arts (art_id);

insert into public.teacher_arts (teacher_id, art_id, school_id)
select distinct t.teacher_id, m.art_id, t.school_id
from public.teacher_specialties t join sp_art m on m.specialty_id = t.specialty_id
where m.art_id is not null
on conflict do nothing;

drop table sp_art;

alter table public.teacher_arts enable row level security;
create policy teacher_arts_select on public.teacher_arts for select to authenticated
  using (public.is_school_member(school_id));
create policy teacher_arts_insert on public.teacher_arts for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy teacher_arts_delete on public.teacher_arts for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
revoke all on public.teacher_arts from anon;
revoke update, truncate, references, trigger on public.teacher_arts from authenticated;

-- Replace a teacher's arts in one call. security invoker: RLS applies (admins only); the composite FK keeps every
-- art in the teacher's school.
create function public.set_teacher_arts(p_teacher_id uuid, p_art_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_school uuid;
begin
  select school_id into v_school from public.teachers where id = p_teacher_id;
  if v_school is null then
    raise exception 'teacher not found';
  end if;
  delete from public.teacher_arts where teacher_id = p_teacher_id;
  insert into public.teacher_arts (teacher_id, art_id, school_id)
  select distinct p_teacher_id, x, v_school from unnest(coalesce(p_art_ids, '{}')) x;
end;
$$;
revoke execute on function public.set_teacher_arts(uuid, uuid[]) from public, anon;
grant execute on function public.set_teacher_arts(uuid, uuid[]) to authenticated;

-- 4. Public landing + trial slots: the discipline is the class's art.
create or replace function public.trial_availability(p_school_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'schedule_id', cs.id, 'class_id', c.id, 'date', d.day, 'start', cs.start_time, 'end', cs.end_time,
      'name', c.name, 'description', c.description, 'discipline', a.name, 'level', c.level, 'color', c.color)
    order by d.day, cs.start_time, c.name), '[]'::jsonb)
  from public.class_schedules cs
  join public.classes c on c.id = cs.class_id and c.active
  join public.schools s on s.id = cs.school_id
  left join public.school_arts a on a.id = c.art_id
  cross join lateral (
    select g::date as day
    from generate_series((now() at time zone 'America/Santiago')::date,
                         (now() at time zone 'America/Santiago')::date + 21, interval '1 day') g
  ) d
  where cs.school_id = p_school_id and extract(isodow from d.day) = cs.weekday
    and d.day + cs.start_time >= (now() at time zone 'America/Santiago') + make_interval(hours => s.trial_min_hours);
$$;
revoke execute on function public.trial_availability(uuid) from public, anon, authenticated;

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
                                            'name', c.name, 'color', c.color, 'level', c.level, 'discipline', a.name)
                         order by cs.weekday, cs.start_time)
        from public.class_schedules cs
        join public.classes c on c.id = cs.class_id and c.active
        left join public.school_arts a on a.id = c.art_id
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
revoke execute on function public.school_landing(text) from public;
grant execute on function public.school_landing(text) to anon, authenticated;
