-- Students contract (or renew) a plan from "Pagos y planes" and pay it with the usual confirmation flow (2026-11-24).
-- * contract_plan(): the student (or a guardian for their child) picks an active, non-trial plan of their school.
--   A new plan → enrollment 'pendiente' + a pending plan payment. Their own plan near or past its end (≤ 7 days) →
--   a pending renewal payment for it. Free plans activate at once. Asking again returns what is already waiting.
-- * When that payment becomes paid (the student reports it and an admin approves, or staff mark it paid) the
--   enrollment activates from today for the plan's duration, or a renewal extends it.
-- * withdraw_plan_contract(): the student drops a contract/renewal that is still unpaid and not reported.
-- Prices come from the plan (new contract) or the enrollment's snapshot (renewal), never from the caller.

create unique index enrollments_one_pending on public.enrollments (student_id, plan_id) where status = 'pendiente';

alter table public.payments add column renews_enrollment boolean not null default false;
comment on column public.payments.renews_enrollment is 'Set by contract_plan(): paying it extends the linked enrollment by the plan duration.';

create or replace function public.contract_plan(p_student_id uuid, p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Santiago')::date;
  st public.students;
  pl public.plans;
  e public.enrollments;
  pay_id uuid;
begin
  if p_student_id is null or p_student_id not in (select public.my_student_ids()) then return jsonb_build_object('error', 'not_allowed'); end if;
  if not public.rate_limit_hit('contract_plan', auth.uid()::text, 20, 3600) then return jsonb_build_object('error', 'too_many'); end if;
  select * into st from public.students where id = p_student_id;
  select * into pl from public.plans where id = p_plan_id and school_id = st.school_id and active and not is_trial;
  if not found then return jsonb_build_object('error', 'plan_unavailable'); end if;

  -- Their own plan: renew it when it is about to end (or ended); otherwise there is nothing to buy.
  select * into e from public.enrollments where student_id = st.id and plan_id = pl.id and status = 'activa' for update;
  if found then
    select id into pay_id from public.payments
    where enrollment_id = e.id and renews_enrollment and status = 'pendiente' order by created_at desc limit 1;
    if pay_id is not null then return jsonb_build_object('enrollment_id', e.id, 'payment_id', pay_id, 'kind', 'renovacion'); end if;
    if e.ends_at is null or e.ends_at > today + 7 or pl.duration_days is null then return jsonb_build_object('error', 'already_active'); end if;
    if e.price = 0 then
      update public.enrollments set ends_at = greatest(e.ends_at, today) + pl.duration_days where id = e.id;
      perform public.audit(st.school_id, 'renew_plan', 'enrollments', e.id, jsonb_build_object('free', true));
      return jsonb_build_object('enrollment_id', e.id, 'kind', 'renovacion', 'active', true);
    end if;
    insert into public.payments (school_id, student_id, enrollment_id, kind, concept, amount, status, due_date, renews_enrollment)
    values (st.school_id, st.id, e.id, 'plan', left('Renovación ' || pl.name, 120), e.price, 'pendiente', today, true)
    returning id into pay_id;
    perform public.audit(st.school_id, 'renew_plan', 'enrollments', e.id, jsonb_build_object('payment', pay_id));
    return jsonb_build_object('enrollment_id', e.id, 'payment_id', pay_id, 'kind', 'renovacion');
  end if;

  -- Already asked for: hand back the waiting payment (a new one if staff removed it).
  select * into e from public.enrollments where student_id = st.id and plan_id = pl.id and status = 'pendiente' for update;
  if found then
    select id into pay_id from public.payments where enrollment_id = e.id and status = 'pendiente' order by created_at desc limit 1;
    if pay_id is null then
      insert into public.payments (school_id, student_id, enrollment_id, kind, concept, amount, status, due_date)
      values (st.school_id, st.id, e.id, 'plan', left('Plan ' || pl.name, 120), e.price, 'pendiente', today)
      returning id into pay_id;
    end if;
    return jsonb_build_object('enrollment_id', e.id, 'payment_id', pay_id, 'kind', 'nuevo');
  end if;

  insert into public.enrollments (school_id, student_id, plan_id, status, start_date, price, enrollment_fee, notes)
  values (st.school_id, st.id, pl.id, case when pl.price = 0 then 'activa' else 'pendiente' end::public.enrollment_status, today,
          pl.price, 0, 'Contratado por el alumno desde la app')
  returning * into e;
  if pl.price = 0 then
    update public.enrollments set ends_at = today + pl.duration_days where id = e.id and pl.duration_days is not null;
    perform public.audit(st.school_id, 'contract_plan', 'enrollments', e.id, jsonb_build_object('free', true));
    return jsonb_build_object('enrollment_id', e.id, 'kind', 'nuevo', 'active', true);
  end if;
  insert into public.payments (school_id, student_id, enrollment_id, kind, concept, amount, status, due_date)
  values (st.school_id, st.id, e.id, 'plan', left('Plan ' || pl.name, 120), pl.price, 'pendiente', today)
  returning id into pay_id;
  perform public.audit(st.school_id, 'contract_plan', 'enrollments', e.id, jsonb_build_object('payment', pay_id));
  return jsonb_build_object('enrollment_id', e.id, 'payment_id', pay_id, 'kind', 'nuevo');
end;
$$;

create or replace function public.withdraw_plan_contract(p_student_id uuid, p_enrollment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.enrollments;
begin
  if p_student_id is null or p_student_id not in (select public.my_student_ids()) then return jsonb_build_object('error', 'not_allowed'); end if;
  select * into e from public.enrollments where id = p_enrollment_id and student_id = p_student_id for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  -- the waiting payments of this contract: the first payment of a pending enrollment, or a renewal
  if exists (
    select 1 from public.payment_submissions s join public.payments p on p.id = s.payment_id
    where p.enrollment_id = e.id and p.status = 'pendiente' and s.status = 'pendiente'
      and (e.status = 'pendiente' or p.renews_enrollment)
  ) then return jsonb_build_object('error', 'reported'); end if;
  if e.status = 'pendiente' then
    delete from public.payments where enrollment_id = e.id and status = 'pendiente';
    delete from public.enrollments where id = e.id;
  elsif e.status = 'activa' then
    delete from public.payments where enrollment_id = e.id and status = 'pendiente' and renews_enrollment;
    if not found then return jsonb_build_object('error', 'not_found'); end if;
  else
    return jsonb_build_object('error', 'not_found');
  end if;
  perform public.audit(e.school_id, 'withdraw_plan', 'enrollments', e.id, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$$;

-- A paid plan payment brings its enrollment to life: a pending contract starts today; a renewal extends it.
create or replace function public.payments_activate_enrollment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Santiago')::date;
  e public.enrollments;
  d smallint;
  other uuid;
begin
  if new.status <> 'pagado' or old.status is not distinct from 'pagado' or new.enrollment_id is null then return new; end if;
  select * into e from public.enrollments where id = new.enrollment_id for update;
  if not found then return new; end if;
  select duration_days into d from public.plans where id = e.plan_id;
  if e.status = 'pendiente' then
    select id into other from public.enrollments where student_id = e.student_id and plan_id = e.plan_id and status = 'activa' for update;
    if other is null then
      update public.enrollments set status = 'activa', start_date = today, ends_at = case when d is not null then today + d end where id = e.id;
    else
      -- staff enrolled them by hand meanwhile: count this payment as a renewal of that one
      update public.enrollments set ends_at = greatest(ends_at, today) + d where id = other and d is not null and ends_at is not null;
      update public.payments set enrollment_id = other where id = new.id;
      delete from public.enrollments where id = e.id;
    end if;
  elsif new.renews_enrollment and e.status = 'activa' and d is not null and e.ends_at is not null then
    update public.enrollments set ends_at = greatest(e.ends_at, today) + d where id = e.id;
  end if;
  return new;
end;
$$;
create trigger payments_activate_enrollment after update of status on public.payments
  for each row execute function public.payments_activate_enrollment();

revoke execute on function public.payments_activate_enrollment() from public, anon, authenticated;
revoke execute on function public.contract_plan(uuid, uuid), public.withdraw_plan_contract(uuid, uuid) from public, anon;
grant execute on function public.contract_plan(uuid, uuid), public.withdraw_plan_contract(uuid, uuid) to authenticated;
