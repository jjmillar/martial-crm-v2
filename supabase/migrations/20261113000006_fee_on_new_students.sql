-- Matrícula per calendar year, refinement: a student who joins during the year IS charged that year's fee
-- automatically, as its own pending payment (separate from the plan), visible on the student profile.
-- Jan 1st still charges everyone who existed on that day (generate_enrollment_fees). Enabling the fee mid-year
-- still does not back-bill students who already existed.
create or replace function public.students_enrollment_fee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Santiago')::date;
  yr int := extract(year from today)::int;
  fee integer;
begin
  if not new.active then return null; end if;
  select enrollment_fee into fee from public.schools where id = new.school_id;
  if coalesce(fee, 0) <= 0 then return null; end if;
  if exists (
    select 1 from public.payments p
    where p.student_id = new.id and p.kind = 'matricula' and p.status not in ('fallido', 'reembolsado')
      and extract(year from coalesce(p.due_date, (p.created_at at time zone 'America/Santiago')::date)) = yr
  ) then return null; end if;
  insert into public.payments (school_id, student_id, kind, concept, amount, status, due_date)
  values (new.school_id, new.id, 'matricula', 'Matrícula ' || yr, fee, 'pendiente', today)
  on conflict do nothing;
  return null;
end;
$$;

create trigger students_enrollment_fee after insert on public.students
  for each row execute function public.students_enrollment_fee();
