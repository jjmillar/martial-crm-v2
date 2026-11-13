-- Card item 4: the enrollment fee ("matrícula") is a school setting, not a plan price.
-- The school sets an amount and how often it is charged (usually every 12 months). Pending "matrícula" payments
-- are generated automatically: right away for new students, and again when the period runs out.
-- Students who joined before the fee was configured are first charged on their next enrollment anniversary,
-- so turning the fee on never back-bills the whole school.

alter table public.schools
  add column enrollment_fee integer not null default 0 check (enrollment_fee >= 0 and enrollment_fee <= 100000000),
  add column enrollment_fee_months smallint not null default 12 check (enrollment_fee_months between 1 and 60),
  add column enrollment_fee_since date;

-- Turning the fee on (0 → amount) stamps the start date used for the anniversary rule above.
create or replace function public.schools_fee_since()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.enrollment_fee > 0 and (tg_op = 'INSERT' or old.enrollment_fee = 0) then
    new.enrollment_fee_since := (now() at time zone 'America/Santiago')::date;
  end if;
  return new;
end;
$$;

create trigger schools_fee_since before insert or update of enrollment_fee on public.schools
  for each row execute function public.schools_fee_since();

-- What a payment is for. Existing rows linked to an enrollment are plan payments.
create type public.payment_kind as enum ('plan', 'matricula', 'otro');
alter table public.payments add column kind public.payment_kind not null default 'otro';
update public.payments set kind = 'plan' where enrollment_id is not null;

-- One live enrollment-fee charge per student and period (the generator relies on it to be idempotent).
create unique index payments_one_fee_per_period on public.payments (student_id, due_date)
  where kind = 'matricula' and status not in ('fallido', 'reembolsado');

-- Next enrollment-fee due date for one student, or null if nothing is due yet.
create or replace function public.enrollment_fee_due(p_student_id uuid)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  st record;
  sc record;
  today date := (now() at time zone 'America/Santiago')::date;
  last_due date;
  nxt date;
  step interval;
begin
  select id, school_id, enrollment_date, active into st from public.students where id = p_student_id;
  if not found or not st.active then return null; end if;
  select enrollment_fee, enrollment_fee_months, coalesce(enrollment_fee_since, today) as since into sc
    from public.schools where id = st.school_id;
  if sc.enrollment_fee <= 0 then return null; end if;
  step := make_interval(months => sc.enrollment_fee_months);

  select max(due_date) into last_due from public.payments
    where student_id = st.id and kind = 'matricula' and status not in ('fallido', 'reembolsado');

  if last_due is null then
    nxt := st.enrollment_date;
    while nxt < sc.since loop nxt := (nxt + step)::date; end loop; -- joined before the fee existed: next anniversary
  else
    nxt := (last_due + step)::date;
  end if;
  if nxt > today then return null; end if;
  -- Several periods missed: charge only the latest one, never a backlog.
  while (nxt + step)::date <= today loop nxt := (nxt + step)::date; end loop;
  return nxt;
end;
$$;

-- Creates the pending charges that are due. Admins run it for their school; the daily job runs it for all.
create or replace function public.generate_enrollment_fees(p_school_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  st record;
  due date;
  made integer := 0;
  n integer;
begin
  if auth.uid() is not null then
    if p_school_id is null or not public.has_school_role(p_school_id, array['admin']::public.school_role[]) then
      raise exception 'only admins of the school can generate enrollment fees';
    end if;
  end if;
  for st in
    select s.id, s.school_id, sc.enrollment_fee
    from public.students s join public.schools sc on sc.id = s.school_id
    where s.active and sc.enrollment_fee > 0 and (p_school_id is null or s.school_id = p_school_id)
  loop
    due := public.enrollment_fee_due(st.id);
    if due is not null then
      insert into public.payments (school_id, student_id, kind, concept, amount, status, due_date)
      values (st.school_id, st.id, 'matricula', 'Matrícula ' || to_char(due, 'YYYY'), st.enrollment_fee, 'pendiente', due)
      on conflict do nothing;
      get diagnostics n = row_count;
      made := made + n;
    end if;
  end loop;
  return made;
end;
$$;

revoke execute on function public.enrollment_fee_due(uuid) from public, anon, authenticated;
revoke execute on function public.generate_enrollment_fees(uuid) from public, anon;
grant execute on function public.generate_enrollment_fees(uuid) to authenticated;

-- New students are charged on creation.
create or replace function public.students_enrollment_fee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  due date := public.enrollment_fee_due(new.id);
  fee integer;
begin
  if due is not null then
    select enrollment_fee into fee from public.schools where id = new.school_id;
    insert into public.payments (school_id, student_id, kind, concept, amount, status, due_date)
    values (new.school_id, new.id, 'matricula', 'Matrícula ' || to_char(due, 'YYYY'), fee, 'pendiente', due)
    on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger students_enrollment_fee after insert on public.students
  for each row execute function public.students_enrollment_fee();
