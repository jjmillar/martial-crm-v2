-- 1. The platform CEO(s) show up in every school's member list (display only: no membership row, so they
--    never count for the last-admin guard and school admins can't remove or demote them).
create or replace function public.platform_ceos()
returns table (user_id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.email
  from public.platform_admins pa join public.profiles p on p.id = pa.user_id
  where public.is_ceo() or exists (select 1 from public.school_members m where m.user_id = auth.uid());
$$;

revoke execute on function public.platform_ceos() from public, anon;
grant execute on function public.platform_ceos() to authenticated;

-- 2. Enrollment fee ("matrícula") per CALENDAR year (Matrícula 2026, 2027…), not per enrollment anniversary.
--    - No charge when a student is created (the user does not want a charge on sign-up).
--    - On January 1st (daily job; it catches up if a day is missed) every student that already existed on Jan 1
--      gets "Matrícula <year>" as a pending payment. Students who join during the year are not charged
--      automatically (register it by hand in Pagos if it applies).
--    - Turning the fee on mid-year starts with next year's charge (never back-bills the current year).
drop trigger if exists students_enrollment_fee on public.students;
drop function if exists public.students_enrollment_fee();
drop function if exists public.generate_enrollment_fees(uuid);
drop function if exists public.enrollment_fee_due(uuid);
comment on column public.schools.enrollment_fee_months is 'Unused since 20261113000005: the fee is per calendar year.';

-- p_today: only honoured for the daily job / service role (lets checks simulate a date); ignored for users.
create or replace function public.generate_enrollment_fees(p_school_id uuid default null, p_today date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Santiago')::date;
  jan1 date;
  yr int;
  made integer;
begin
  if auth.uid() is not null then
    if p_school_id is null or not public.has_school_role(p_school_id, array['admin']::public.school_role[]) then
      raise exception 'only admins of the school can generate enrollment fees';
    end if;
  elsif p_today is not null then
    today := p_today;
  end if;
  yr := extract(year from today)::int;
  jan1 := make_date(yr, 1, 1);

  insert into public.payments (school_id, student_id, kind, concept, amount, status, due_date)
  select s.school_id, s.id, 'matricula', 'Matrícula ' || yr, sc.enrollment_fee, 'pendiente', jan1
  from public.students s
  join public.schools sc on sc.id = s.school_id
  where s.active
    and sc.enrollment_fee > 0
    and (p_school_id is null or s.school_id = p_school_id)
    and coalesce(sc.enrollment_fee_since, today) <= jan1                         -- fee was on by Jan 1
    and (s.created_at at time zone 'America/Santiago')::date <= jan1              -- student existed on Jan 1
    and not exists (
      select 1 from public.payments p
      where p.student_id = s.id and p.kind = 'matricula' and p.status not in ('fallido', 'reembolsado')
        and extract(year from coalesce(p.due_date, (p.created_at at time zone 'America/Santiago')::date)) = yr
    )
  on conflict do nothing;
  get diagnostics made = row_count;
  return made;
end;
$$;

revoke execute on function public.generate_enrollment_fees(uuid, date) from public, anon;
grant execute on function public.generate_enrollment_fees(uuid, date) to authenticated;
