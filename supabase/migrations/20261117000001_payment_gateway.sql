-- Payment gateway: every "Pagar" in the app leads to one checkout. For now the only enabled method is bank
-- transfer: the student sees the school's transfer data, transfers, and presses "Pagar". That creates a
-- submission the school's CEO reviews; approving it marks the payment as paid.

-- 1. The school's transfer data (shown to its students at checkout) -----------------------------------------
alter table public.schools
  add column transfer_bank text check (transfer_bank is null or length(btrim(transfer_bank)) between 1 and 60),
  add column transfer_account_type text check (transfer_account_type is null or length(btrim(transfer_account_type)) between 1 and 40),
  add column transfer_account_number text check (transfer_account_number is null or length(btrim(transfer_account_number)) between 1 and 40),
  add column transfer_holder text check (transfer_holder is null or length(btrim(transfer_holder)) between 1 and 80),
  add column transfer_rut text check (transfer_rut is null or length(btrim(transfer_rut)) between 1 and 20),
  add column transfer_email text check (transfer_email is null or length(btrim(transfer_email)) between 3 and 120);

-- 2. Submissions ("I paid, please check") -------------------------------------------------------------------
create table public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  method public.payment_method not null,
  amount integer not null check (amount > 0),
  reference text check (reference is null or length(reference) <= 120),
  status public.request_status not null default 'pendiente',
  reject_reason text check (reject_reason is null or length(reject_reason) <= 200),
  submitted_by uuid references auth.users (id) on delete set null default auth.uid(),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index payment_submissions_one_pending on public.payment_submissions (payment_id) where status = 'pendiente';
create index payment_submissions_school_idx on public.payment_submissions (school_id, status, created_at desc);

alter table public.payment_submissions enable row level security;
-- The student sees their own; the school's team sees the school's. Writes only through the RPCs below.
create policy payment_submissions_select on public.payment_submissions for select to authenticated
  using (student_id in (select public.my_student_ids()) or public.is_school_member(school_id));

-- 3. The student pays (the "Pagar" button) -------------------------------------------------------------------
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
  if p_method is distinct from 'transferencia' then raise exception 'method not enabled'; end if;
  select * into sc from public.schools where id = p.school_id;
  if sc.transfer_account_number is null then raise exception 'transfer not configured'; end if;
  if exists (select 1 from public.payment_submissions where payment_id = p.id and status = 'pendiente') then
    raise exception 'already submitted';
  end if;
  insert into public.payment_submissions (payment_id, school_id, student_id, method, amount, reference)
  values (p.id, p.school_id, p.student_id, p_method, p.amount, nullif(btrim(p_reference), ''))
  returning id into sid;
  return sid;
end;
$$;
revoke execute on function public.submit_payment(uuid, public.payment_method, text) from public, anon;
grant execute on function public.submit_payment(uuid, public.payment_method, text) to authenticated;

-- 4. The school's CEO checks the transfer and approves (payment → pagado) or rejects it -----------------------
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
  if not (public.is_ceo() or public.is_school_owner(s.school_id)) then raise exception 'only the CEO can decide payments'; end if;
  if s.status <> 'pendiente' then raise exception 'submission already decided'; end if;
  if p_approve then
    update public.payments set status = 'pagado', method = s.method where id = s.payment_id and status = 'pendiente';
    if not found then raise exception 'payment not pending'; end if;
  end if;
  update public.payment_submissions
  set status = case when p_approve then 'aprobada'::public.request_status else 'rechazada' end,
      reject_reason = case when p_approve then null else nullif(btrim(p_reason), '') end,
      decided_by = auth.uid(), decided_at = now()
  where id = s.id;
end;
$$;
revoke execute on function public.decide_payment_submission(uuid, boolean, text) from public, anon;
grant execute on function public.decide_payment_submission(uuid, boolean, text) to authenticated;
