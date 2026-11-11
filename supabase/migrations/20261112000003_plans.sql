-- T6: membership plans (S2, S6, S7). Money is CLP in integer pesos.
-- Improvements over v1: discipline from the specialties catalog (null = all/mixed), Spanish billing cycles incl.
-- one-time packs, enrollment fee (matrícula), a single default plan per school enforced in the DB.

create type public.billing_cycle as enum ('mensual', 'trimestral', 'semestral', 'anual', 'unico');

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  specialty_id uuid,
  price integer not null check (price >= 0 and price <= 100000000),
  enrollment_fee integer not null default 0 check (enrollment_fee >= 0 and enrollment_fee <= 100000000),
  billing_cycle public.billing_cycle not null default 'mensual',
  duration_days smallint check (duration_days between 1 and 730),
  sessions_per_week smallint check (sessions_per_week between 1 and 14),
  class_count smallint check (class_count between 1 and 500),
  description text check (description is null or length(description) <= 400),
  is_trial boolean not null default false,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name),
  unique (id, school_id),
  -- discipline must be a specialty of the same school; deleting it turns the plan into "all disciplines"
  foreign key (specialty_id, school_id) references public.specialties (id, school_id) on delete set null (specialty_id),
  -- an inactive plan cannot be the default one
  constraint plans_default_active check (not (is_default and not active))
);

create unique index plans_one_default_per_school on public.plans (school_id) where is_default;
create index plans_school_idx on public.plans (school_id, active);

create trigger plans_set_updated_at before update on public.plans
  for each row execute function public.set_updated_at();
create trigger plans_school_fixed before update on public.plans
  for each row execute function public.prevent_school_change();

-- Marking a plan as default unmarks the previous one (same school). Runs as the caller, so RLS still applies.
create or replace function public.plans_single_default()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.is_default then
    update public.plans set is_default = false
    where school_id = new.school_id and is_default and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger plans_single_default before insert or update of is_default on public.plans
  for each row when (new.is_default) execute function public.plans_single_default();

alter table public.plans enable row level security;

-- Every member reads plans (to enroll students); only admins manage them (S3).
create policy plans_select on public.plans for select to authenticated
  using (public.is_school_member(school_id));
create policy plans_insert on public.plans for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy plans_update on public.plans for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy plans_delete on public.plans for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
