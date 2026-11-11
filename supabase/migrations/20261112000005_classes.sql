-- T8: classes, their tags and weekly schedule blocks (S2, S6).
-- Improvements over v1: composite FKs keep discipline/teacher/tags in the same school; level as an enum;
-- a colour for the calendar; schedule blocks validated (end after start) and a teacher can't be double-booked.

create extension if not exists btree_gist with schema extensions;

create type public.class_level as enum ('todos', 'principiante', 'intermedio', 'avanzado', 'ninos', 'competicion');

alter table public.teachers add constraint teachers_id_school_unique unique (id, school_id);
alter table public.tags add constraint tags_id_school_key unique (id, school_id);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  specialty_id uuid,
  teacher_id uuid,
  room text check (room is null or length(room) <= 60),
  capacity smallint check (capacity between 1 and 500),
  level public.class_level not null default 'todos',
  color text not null default '#e0492c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  notes text check (notes is null or length(notes) <= 400),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id),
  foreign key (specialty_id, school_id) references public.specialties (id, school_id) on delete set null (specialty_id),
  foreign key (teacher_id, school_id) references public.teachers (id, school_id) on delete set null (teacher_id)
);

create index classes_school_idx on public.classes (school_id, active);

create trigger classes_set_updated_at before update on public.classes
  for each row execute function public.set_updated_at();
create trigger classes_school_fixed before update on public.classes
  for each row execute function public.prevent_school_change();

create table public.class_tags (
  class_id uuid not null,
  tag_id uuid not null,
  school_id uuid not null references public.schools (id) on delete cascade,
  primary key (class_id, tag_id),
  foreign key (class_id, school_id) references public.classes (id, school_id) on delete cascade,
  foreign key (tag_id, school_id) references public.tags (id, school_id) on delete cascade
);

-- weekday: ISO 1 = Monday ... 7 = Sunday.
create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  -- denormalised from the class so the overlap rule below can be a constraint; kept in sync by triggers
  teacher_id uuid,
  foreign key (class_id, school_id) references public.classes (id, school_id) on delete cascade,
  constraint class_schedules_time_order check (end_time > start_time),
  -- the same teacher can't be in two overlapping blocks on the same weekday
  constraint class_schedules_teacher_overlap exclude using gist (
    teacher_id with =,
    weekday with =,
    tsrange('2000-01-01'::date + start_time, '2000-01-01'::date + end_time) with &&
  ) where (teacher_id is not null)
);

create index class_schedules_school_day_idx on public.class_schedules (school_id, weekday, start_time);
create index class_schedules_class_idx on public.class_schedules (class_id);

-- Keep class_schedules.teacher_id equal to the class's teacher.
create or replace function public.class_schedules_sync_teacher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select c.teacher_id into new.teacher_id from public.classes c where c.id = new.class_id;
  return new;
end;
$$;

create trigger class_schedules_teacher before insert or update on public.class_schedules
  for each row execute function public.class_schedules_sync_teacher();

create or replace function public.classes_propagate_teacher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.class_schedules set teacher_id = new.teacher_id where class_id = new.id;
  return new;
end;
$$;

create trigger classes_teacher_changed after update of teacher_id on public.classes
  for each row when (old.teacher_id is distinct from new.teacher_id)
  execute function public.classes_propagate_teacher();

alter table public.classes enable row level security;
alter table public.class_tags enable row level security;
alter table public.class_schedules enable row level security;

create policy classes_select on public.classes for select to authenticated using (public.is_school_member(school_id));
create policy classes_insert on public.classes for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy classes_update on public.classes for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy classes_delete on public.classes for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

create policy class_tags_select on public.class_tags for select to authenticated using (public.is_school_member(school_id));
create policy class_tags_insert on public.class_tags for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy class_tags_delete on public.class_tags for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

create policy class_schedules_select on public.class_schedules for select to authenticated using (public.is_school_member(school_id));
create policy class_schedules_insert on public.class_schedules for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy class_schedules_update on public.class_schedules for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy class_schedules_delete on public.class_schedules for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

-- Save a class's tags and schedule in one transaction (security invoker: RLS applies).
-- p_blocks: [{"weekday":1,"start_time":"19:00","end_time":"20:30"}, ...]
create or replace function public.set_class_details(p_class_id uuid, p_tag_ids uuid[], p_blocks jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_school uuid;
begin
  select school_id into v_school from public.classes where id = p_class_id;
  if v_school is null then
    raise exception 'class not found';
  end if;
  -- RLS would silently skip the deletes for non-admins; fail loudly instead.
  if not public.has_school_role(v_school, array['admin']::public.school_role[]) then
    raise exception 'only admins can edit classes';
  end if;
  delete from public.class_tags where class_id = p_class_id;
  insert into public.class_tags (class_id, tag_id, school_id)
  select p_class_id, unnest(coalesce(p_tag_ids, '{}')), v_school;
  delete from public.class_schedules where class_id = p_class_id;
  insert into public.class_schedules (school_id, class_id, weekday, start_time, end_time)
  select v_school, p_class_id, (b->>'weekday')::smallint, (b->>'start_time')::time, (b->>'end_time')::time
  from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) b;
end;
$$;
