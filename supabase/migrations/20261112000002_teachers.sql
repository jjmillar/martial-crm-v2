-- T5: teachers and their specialties (S2, S6).
-- Improvements over v1: specialties via a join table with composite FKs (no cross-school links, no dangling ids),
-- belt/degree and bio, and an optional link to a member account (for taking attendance later).

-- Composite keys so child rows can prove they belong to the same school.
alter table public.specialties add constraint specialties_id_school_key unique (id, school_id);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  first_name text not null check (length(btrim(first_name)) > 0),
  first_last_name text not null check (length(btrim(first_last_name)) > 0),
  second_last_name text,
  full_name text generated always as (
    btrim(regexp_replace(first_name || ' ' || first_last_name || ' ' || coalesce(second_last_name, ''), '\s+', ' ', 'g'))
  ) stored,
  rut text constraint teachers_rut_valid check (public.rut_is_valid(rut)),
  email text,
  phone text,
  belt text,
  belt_degree smallint check (belt_degree between 0 and 12),
  bio text check (bio is null or length(bio) <= 600),
  user_id uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id)
);

create unique index teachers_school_rut_key on public.teachers (school_id, rut) where rut is not null;
create unique index teachers_school_user_key on public.teachers (school_id, user_id) where user_id is not null;
create index teachers_school_name_idx on public.teachers (school_id, full_name);

create trigger teachers_set_updated_at before update on public.teachers
  for each row execute function public.set_updated_at();
create trigger teachers_school_fixed before update on public.teachers
  for each row execute function public.prevent_school_change();

-- A linked account must belong to the teacher's school.
create or replace function public.check_teacher_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null and not exists (
    select 1 from public.school_members m where m.school_id = new.school_id and m.user_id = new.user_id
  ) then
    raise exception 'linked user must be a member of the school';
  end if;
  return new;
end;
$$;

create trigger teachers_user_member before insert or update of user_id, school_id on public.teachers
  for each row execute function public.check_teacher_user();

create table public.teacher_specialties (
  teacher_id uuid not null,
  specialty_id uuid not null,
  school_id uuid not null references public.schools (id) on delete cascade,
  primary key (teacher_id, specialty_id),
  foreign key (teacher_id, school_id) references public.teachers (id, school_id) on delete cascade,
  foreign key (specialty_id, school_id) references public.specialties (id, school_id) on delete cascade
);

create index teacher_specialties_specialty_idx on public.teacher_specialties (specialty_id);

-- RLS: every member reads; admins manage.
alter table public.teachers enable row level security;
alter table public.teacher_specialties enable row level security;

create policy teachers_select on public.teachers for select to authenticated
  using (public.is_school_member(school_id));
create policy teachers_insert on public.teachers for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy teachers_update on public.teachers for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy teachers_delete on public.teachers for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

create policy teacher_specialties_select on public.teacher_specialties for select to authenticated
  using (public.is_school_member(school_id));
create policy teacher_specialties_insert on public.teacher_specialties for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy teacher_specialties_delete on public.teacher_specialties for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

-- Replace a teacher's specialties in one call (admin only via RLS). security invoker: RLS applies.
create or replace function public.set_teacher_specialties(p_teacher_id uuid, p_specialty_ids uuid[])
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
  delete from public.teacher_specialties where teacher_id = p_teacher_id;
  insert into public.teacher_specialties (teacher_id, specialty_id, school_id)
  select p_teacher_id, unnest(coalesce(p_specialty_ids, '{}')), v_school;
end;
$$;

-- When someone leaves the school, unlink their account from its teacher record (the record itself stays).
create or replace function public.unlink_teacher_on_member_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.teachers set user_id = null where school_id = old.school_id and user_id = old.user_id;
  return old;
end;
$$;

create trigger school_members_unlink_teacher after delete on public.school_members
  for each row execute function public.unlink_teacher_on_member_removed();
