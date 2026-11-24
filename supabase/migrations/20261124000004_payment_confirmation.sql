-- Payment confirmation, like attendance (2026-11-24). For now students pay by transfer or in cash.
-- * The student (or guardian) marks a pending payment as paid ("Ya pagué"): transfer or cash. That is a submission
--   waiting for the school.
-- * The school's admins (and the owner) approve it → paid with a double check: the student reported it and the
--   school confirmed it.
-- * An admin can also mark the payment paid directly (e.g. the student said so by WhatsApp): a single check. If the
--   student had reported it too, that report is approved with it (double check).
-- Online payment gateways come later.

-- 1. The student may report cash too; transfer data is only needed for transfers.
create or replace function public.submit_payment(p_payment_id uuid, p_method public.payment_method, p_reference text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
  sc public.schools;
  sid uuid;
begin
  select * into p from public.payments where id = p_payment_id;
  if not found or p.student_id not in (select public.my_student_ids()) then raise exception 'payment not found'; end if;
  if p.status <> 'pendiente' then raise exception 'payment not pending'; end if;
  if p_method is null or p_method not in ('transferencia', 'efectivo') then raise exception 'method not enabled'; end if;
  if p_reference is not null and length(btrim(p_reference)) > 120 then raise exception 'reference too long'; end if;
  select * into sc from public.schools where id = p.school_id;
  if p_method = 'transferencia' and sc.transfer_account_number is null then raise exception 'transfer not configured'; end if;
  if exists (select 1 from public.payment_submissions where payment_id = p.id and status = 'pendiente') then
    raise exception 'already submitted';
  end if;
  insert into public.payment_submissions (payment_id, school_id, student_id, method, amount, reference)
  values (p.id, p.school_id, p.student_id, p_method, p.amount, nullif(btrim(p_reference), ''))
  returning id into sid;
  return sid;
end;
$$;

-- 2. Admins decide too (they can already mark payments paid directly under payments_update).
create or replace function public.decide_payment_submission(p_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.payment_submissions;
begin
  select * into s from public.payment_submissions where id = p_id;
  if not found then raise exception 'submission not found'; end if;
  if not public.has_school_role(s.school_id, array['admin']::public.school_role[]) then raise exception 'only admins can decide payments'; end if;
  if s.status <> 'pendiente' then raise exception 'submission already decided'; end if;
  if p_approve then
    -- the payment trigger below closes this submission as approved
    update public.payments set status = 'pagado', method = s.method where id = s.payment_id and status = 'pendiente';
    if not found then raise exception 'payment not pending'; end if;
  else
    update public.payment_submissions
    set status = 'rechazada', reject_reason = left(nullif(btrim(p_reason), ''), 200), decided_by = auth.uid(), decided_at = now()
    where id = s.id;
  end if;
end;
$$;

-- 3. A payment that becomes paid (by approval or marked directly) closes the student's pending report as approved.
create or replace function public.payments_close_submission()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'pagado' and old.status is distinct from 'pagado' then
    update public.payment_submissions
    set status = 'aprobada', reject_reason = null, decided_by = auth.uid(), decided_at = now()
    where payment_id = new.id and status = 'pendiente';
  end if;
  return new;
end;
$$;
revoke execute on function public.payments_close_submission() from public, anon, authenticated;
create trigger payments_close_submission after update of status on public.payments
  for each row execute function public.payments_close_submission();
