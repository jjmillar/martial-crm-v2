-- T3 + T4: catalogs (specialties, tags) and students (S2, S6, S7).

-- Rows never move between schools.
create or replace function public.prevent_school_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.school_id <> old.school_id then
    raise exception 'school_id cannot change';
  end if;
  return new;
end;
$$;

-- Chilean RUT, format 'NNNNNNNN-D': modulo 11 with factors 2..7 from the right (11 -> 0, 10 -> K). Null is valid.
create or replace function public.rut_is_valid(p_rut text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  body text;
  dv text;
  total int := 0;
  factor int := 2;
  i int;
  r int;
  expected text;
begin
  if p_rut is null then
    return true;
  end if;
  if p_rut !~ '^[0-9]{7,8}-[0-9K]$' then
    return false;
  end if;
  body := split_part(p_rut, '-', 1);
  dv := split_part(p_rut, '-', 2);
  for i in reverse length(body)..1 loop
    total := total + substr(body, i, 1)::int * factor;
    factor := case when factor = 7 then 2 else factor + 1 end;
  end loop;
  r := 11 - (total % 11);
  expected := case r when 11 then '0' when 10 then 'K' else r::text end;
  return dv = expected;
end;
$$;

-- Catalogs ------------------------------------------------------------------

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 60),
  icon text check (icon is null or length(icon) <= 8),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, label)
);

-- Students ------------------------------------------------------------------

create type public.gender as enum ('masculino', 'femenino', 'otro');

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  first_name text not null check (length(btrim(first_name)) > 0),
  middle_name text,
  first_last_name text not null check (length(btrim(first_last_name)) > 0),
  second_last_name text,
  full_name text generated always as (
    -- concat_ws is only stable, so plain || keeps the expression immutable
    btrim(regexp_replace(
      first_name || ' ' || coalesce(middle_name, '') || ' ' || first_last_name || ' ' || coalesce(second_last_name, ''),
      '\s+', ' ', 'g'
    ))
  ) stored,
  rut text constraint students_rut_valid check (public.rut_is_valid(rut)),
  gender public.gender,
  birth_date date,
  enrollment_date date not null default current_date,
  email text,
  phone text,
  belt text,
  belt_degree smallint check (belt_degree between 0 and 12),
  weight_kg numeric(5, 1) check (weight_kg > 0 and weight_kg < 400),
  address text,
  emergency_contact text,
  emergency_phone text,
  medical_notes text,
  notes text,
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index students_school_rut_key on public.students (school_id, rut) where rut is not null;
create index students_school_name_idx on public.students (school_id, full_name);

create trigger students_set_updated_at before update on public.students
  for each row execute function public.set_updated_at();

create trigger specialties_school_fixed before update on public.specialties
  for each row execute function public.prevent_school_change();
create trigger tags_school_fixed before update on public.tags
  for each row execute function public.prevent_school_change();
create trigger students_school_fixed before update on public.students
  for each row execute function public.prevent_school_change();

-- RLS -----------------------------------------------------------------------

alter table public.specialties enable row level security;
alter table public.tags enable row level security;
alter table public.students enable row level security;

-- Catalogs: every member reads, admins manage.
create policy specialties_select on public.specialties for select to authenticated
  using (public.is_school_member(school_id));
create policy specialties_insert on public.specialties for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy specialties_update on public.specialties for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy specialties_delete on public.specialties for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

create policy tags_select on public.tags for select to authenticated
  using (public.is_school_member(school_id));
create policy tags_insert on public.tags for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy tags_update on public.tags for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy tags_delete on public.tags for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

-- Students: every member works day to day (read, create, edit); only admins delete.
create policy students_select on public.students for select to authenticated
  using (public.is_school_member(school_id));
create policy students_insert on public.students for insert to authenticated
  with check (public.is_school_member(school_id));
create policy students_update on public.students for update to authenticated
  using (public.is_school_member(school_id))
  with check (public.is_school_member(school_id));
create policy students_delete on public.students for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
