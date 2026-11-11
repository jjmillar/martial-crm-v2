-- T10: attendance (S2, S6). One row per class + student + date means "present".
-- 20261112000005 added teachers_id_school_unique, a duplicate of the inline unique (id, school_id) on teachers.
-- Drop whichever duplicate no foreign key depends on.
do $$
begin
  alter table public.teachers drop constraint teachers_id_school_unique;
exception when dependent_objects_still_exist then
  alter table public.teachers drop constraint teachers_id_school_id_key;
end;
$$;

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null,
  student_id uuid not null,
  date date not null default current_date,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (class_id, student_id, date),
  foreign key (class_id, school_id) references public.classes (id, school_id) on delete cascade,
  foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade,
  -- no marking more than a day ahead (timezone slack); history is fine
  constraint attendance_not_future check (date <= current_date + 1)
);

create index attendance_school_date_idx on public.attendance (school_id, date);
create index attendance_student_idx on public.attendance (student_id, date desc);

create trigger attendance_created_by before insert on public.attendance
  for each row execute function public.set_created_by();
create trigger attendance_school_fixed before update on public.attendance
  for each row execute function public.prevent_school_change();

alter table public.attendance enable row level security;

-- Every member takes attendance (S3: users work with attendance).
create policy attendance_select on public.attendance for select to authenticated using (public.is_school_member(school_id));
create policy attendance_insert on public.attendance for insert to authenticated with check (public.is_school_member(school_id));
create policy attendance_delete on public.attendance for delete to authenticated using (public.is_school_member(school_id));
