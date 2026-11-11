-- T7: enrollments, student <-> plan (S2, S6).
-- Improvements over v1: price and enrollment fee are snapshotted at enrollment time (later plan price changes
-- don't rewrite history); composite FKs keep student and plan in the same school; one active enrollment per
-- student and plan.

create type public.enrollment_status as enum ('activa', 'pausada', 'cancelada');

alter table public.students add constraint students_id_school_key unique (id, school_id);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null,
  plan_id uuid not null,
  status public.enrollment_status not null default 'activa',
  start_date date not null default current_date,
  ends_at date,
  price integer not null check (price >= 0),
  enrollment_fee integer not null default 0 check (enrollment_fee >= 0),
  notes text check (notes is null or length(notes) <= 400),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id),
  foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade,
  -- plans with enrollments can't be deleted (deactivate them instead)
  foreign key (plan_id, school_id) references public.plans (id, school_id) on delete restrict,
  constraint enrollments_dates check (ends_at is null or ends_at >= start_date)
);

create unique index enrollments_one_active on public.enrollments (student_id, plan_id) where status = 'activa';
create index enrollments_school_status_idx on public.enrollments (school_id, status, ends_at);
create index enrollments_student_idx on public.enrollments (student_id);

-- created_by always records the real caller (service-role/background writes keep what they pass).
create or replace function public.set_created_by()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;

create trigger enrollments_created_by before insert on public.enrollments
  for each row execute function public.set_created_by();
create trigger enrollments_set_updated_at before update on public.enrollments
  for each row execute function public.set_updated_at();
create trigger enrollments_school_fixed before update on public.enrollments
  for each row execute function public.prevent_school_change();

alter table public.enrollments enable row level security;

-- Front desk work: every member reads, enrolls and updates; only admins delete.
create policy enrollments_select on public.enrollments for select to authenticated
  using (public.is_school_member(school_id));
create policy enrollments_insert on public.enrollments for insert to authenticated
  with check (public.is_school_member(school_id));
create policy enrollments_update on public.enrollments for update to authenticated
  using (public.is_school_member(school_id))
  with check (public.is_school_member(school_id));
create policy enrollments_delete on public.enrollments for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
