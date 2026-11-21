-- Discount codes. The school's admins create codes (e.g. "VERANO20") that take a percentage or a fixed amount
-- off. A code is either:
--   * 'pago': it discounts one payment (e.g. a promo for certain months, together with the validity dates), or
--   * 'plan': it discounts an enrollment permanently: the payment it is applied on and every later plan payment
--     of that enrollment.
-- Each code has an optional number of uses (1 = single use, N = a "stock", empty = unlimited), optional
-- validity dates and an optional plan it is limited to. A student can use the same code only once.
--
-- Security:
--   * students never read the codes table (no enumeration); they only redeem through redeem_discount(), which
--     is rate limited per user (10 tries per hour) and checks the payment belongs to them (or to their child);
--   * discount fields on payments/enrollments can only be written by the RPCs below (guard triggers);
--   * every redemption and removal is in the audit log; the value is snapshotted, so editing a code later never
--     changes past payments.

create type public.discount_scope as enum ('pago', 'plan');

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{2,23}$'),
  description text check (description is null or length(description) <= 200),
  percent smallint check (percent between 1 and 100),
  amount integer check (amount between 1 and 100000000),
  scope public.discount_scope not null default 'pago',
  plan_id uuid,
  max_uses integer check (max_uses between 1 and 100000),
  valid_from date,
  valid_until date,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, code),
  unique (id, school_id),
  foreign key (plan_id, school_id) references public.plans (id, school_id) on delete set null (plan_id),
  constraint discount_codes_one_value check ((percent is null) <> (amount is null)),
  constraint discount_codes_dates check (valid_until is null or valid_from is null or valid_until >= valid_from)
);
create index discount_codes_school_idx on public.discount_codes (school_id, active);

create trigger discount_codes_set_updated_at before update on public.discount_codes
  for each row execute function public.set_updated_at();
create trigger discount_codes_school_fixed before update on public.discount_codes
  for each row execute function public.prevent_school_change();
create trigger discount_codes_created_by before insert on public.discount_codes
  for each row execute function public.set_created_by();

create table public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null,
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null,
  payment_id uuid references public.payments (id) on delete cascade,
  enrollment_id uuid references public.enrollments (id) on delete cascade,
  discount integer not null default 0 check (discount >= 0),
  redeemed_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (code_id, school_id) references public.discount_codes (id, school_id) on delete restrict,
  foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade,
  unique (code_id, student_id)
);
create index discount_redemptions_code_idx on public.discount_redemptions (code_id, created_at desc);

-- Snapshots on the payment and the enrollment ------------------------------------------------------------------
alter table public.payments
  add column discount_code_id uuid references public.discount_codes (id) on delete set null,
  add column discount_code text,
  add column discount_amount integer not null default 0 check (discount_amount >= 0);
-- A 100 % discount leaves a $0 payment (already paid); any other payment still needs an amount.
alter table public.payments drop constraint payments_amount_check;
alter table public.payments add constraint payments_amount_check
  check (amount <= 100000000 and (amount > 0 or (amount = 0 and discount_amount > 0)));

alter table public.enrollments
  add column discount_code_id uuid references public.discount_codes (id) on delete set null,
  add column discount_code text,
  add column discount_percent smallint check (discount_percent between 1 and 100),
  add column discount_fixed integer check (discount_fixed > 0);

-- Discount of one code/snapshot on an amount (never more than the amount).
create or replace function public.discount_of(p_amount integer, p_percent smallint, p_fixed integer)
returns integer language sql immutable set search_path = ''
as $$ select case when p_percent is not null then least(p_amount, round(p_amount * p_percent / 100.0)::integer)
                  when p_fixed is not null then least(p_amount, p_fixed) else 0 end; $$;

-- Guards: the discount columns are only written by the functions below (which set mcrm.discount) -----------------
create or replace function public.payments_discount_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  e public.enrollments;
  d integer;
begin
  if coalesce(current_setting('mcrm.discount', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.discount_code_id := null; new.discount_code := null; new.discount_amount := 0;
    -- New plan payment of an enrollment with a permanent discount: apply it.
    if new.kind = 'plan' and new.enrollment_id is not null then
      select * into e from public.enrollments where id = new.enrollment_id;
      if found and e.discount_code is not null then
        d := public.discount_of(new.amount, e.discount_percent, e.discount_fixed);
        if d > 0 then
          new.discount_code_id := e.discount_code_id; new.discount_code := e.discount_code; new.discount_amount := d;
          new.amount := new.amount - d;
          if new.amount = 0 then new.status := 'pagado'; new.method := 'otro'; end if;
        end if;
      end if;
    end if;
  elsif (new.discount_code_id, new.discount_code, new.discount_amount) is distinct from (old.discount_code_id, old.discount_code, old.discount_amount) then
    raise exception 'discounts are applied with a discount code';
  end if;
  return new;
end;
$$;
-- Named to run before payments_confirmation (triggers fire by name), so a $0 payment gets paid_at.
create trigger payments_apply_discount before insert or update on public.payments
  for each row execute function public.payments_discount_guard();

create or replace function public.enrollments_discount_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(current_setting('mcrm.discount', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.discount_code_id := null; new.discount_code := null; new.discount_percent := null; new.discount_fixed := null;
  elsif (new.discount_code_id, new.discount_code, new.discount_percent, new.discount_fixed)
        is distinct from (old.discount_code_id, old.discount_code, old.discount_percent, old.discount_fixed) then
    raise exception 'discounts are applied with a discount code';
  end if;
  return new;
end;
$$;
create trigger enrollments_discount_guard before insert or update on public.enrollments
  for each row execute function public.enrollments_discount_guard();

-- Uses can't go below what was already used.
create or replace function public.discount_codes_uses_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.max_uses is not null and new.max_uses < (select count(*) from public.discount_redemptions where code_id = new.id) then
    raise exception 'max uses below uses already made';
  end if;
  return new;
end;
$$;
create trigger discount_codes_uses_guard before update of max_uses on public.discount_codes
  for each row execute function public.discount_codes_uses_guard();

-- RLS: only the school's admins (and CEO/owner) see and manage codes; uses are visible to them too --------------
alter table public.discount_codes enable row level security;
alter table public.discount_redemptions enable row level security;
create policy discount_codes_select on public.discount_codes for select to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy discount_codes_insert on public.discount_codes for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy discount_codes_update on public.discount_codes for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy discount_codes_delete on public.discount_codes for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy discount_redemptions_select on public.discount_redemptions for select to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

-- Admin list: codes with how many times they were used.
create or replace function public.discount_code_uses(p_school_id uuid)
returns table (code_id uuid, uses integer, saved bigint)
language sql stable security definer set search_path = ''
as $$
  select r.code_id, count(*)::integer, coalesce(sum(r.discount), 0)::bigint
  from public.discount_redemptions r
  where r.school_id = p_school_id and public.has_school_role(p_school_id, array['admin']::public.school_role[])
  group by r.code_id;
$$;

-- Validates a code for a student (and the plan it would discount). Returns the code or an error key. ------------
create or replace function public.discount_lookup(p_school uuid, p_code text, p_student uuid, p_plan uuid, p_no_plan boolean,
  out c public.discount_codes, out err text)
language plpgsql security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Santiago')::date;
  used integer;
begin
  select * into c from public.discount_codes
    where school_id = p_school and code = upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'))
    for update;
  if not found or not c.active then err := 'invalid'; return; end if;
  if c.valid_from is not null and today < c.valid_from then err := 'not_yet'; return; end if;
  if c.valid_until is not null and today > c.valid_until then err := 'expired'; return; end if;
  if exists (select 1 from public.discount_redemptions where code_id = c.id and student_id = p_student) then err := 'used'; return; end if;
  select count(*) into used from public.discount_redemptions where code_id = c.id;
  if c.max_uses is not null and used >= c.max_uses then err := 'exhausted'; return; end if;
  if c.plan_id is not null and c.plan_id is distinct from p_plan then err := 'plan'; return; end if;
  if c.scope = 'plan' and p_no_plan then err := 'plan_only'; return; end if;
end;
$$;

-- Redeem on a pending payment: the student (or guardian) at checkout, or the school's team. ---------------------
create or replace function public.redeem_discount(p_payment_id uuid, p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  p public.payments;
  e public.enrollments;
  r record;
  d integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into p from public.payments where id = p_payment_id for update;
  if not found or not (p.student_id in (select public.my_student_ids()) or public.is_school_member(p.school_id)) then
    raise exception 'payment not found';
  end if;
  -- 10 tries per hour per user (counted before validating, so guessing codes is slow).
  if not public.rate_limit_hit('discount', auth.uid()::text, 10, 3600) then return jsonb_build_object('error', 'too_many'); end if;
  if p.status <> 'pendiente' then return jsonb_build_object('error', 'not_pending'); end if;
  if p.discount_amount > 0 then return jsonb_build_object('error', 'has_discount'); end if;
  if exists (select 1 from public.payment_submissions where payment_id = p.id and status = 'pendiente') then
    return jsonb_build_object('error', 'in_review');
  end if;
  if p.enrollment_id is not null then select * into e from public.enrollments where id = p.enrollment_id; end if;

  select * into r from public.discount_lookup(p.school_id, p_code, p.student_id, e.plan_id,
    not (p.kind = 'plan' and p.enrollment_id is not null and e.discount_code is null));
  if r.err is not null then return jsonb_build_object('error', r.err); end if;

  d := public.discount_of(p.amount, (r.c).percent, (r.c).amount);
  perform set_config('mcrm.discount', '1', true);
  update public.payments set
    discount_code_id = (r.c).id, discount_code = (r.c).code, discount_amount = d, amount = amount - d,
    status = case when amount - d = 0 then 'pagado'::public.payment_status else status end,
    method = case when amount - d = 0 then 'otro'::public.payment_method else method end
  where id = p.id;
  if (r.c).scope = 'plan' then
    update public.enrollments set discount_code_id = (r.c).id, discount_code = (r.c).code,
      discount_percent = (r.c).percent, discount_fixed = (r.c).amount
    where id = e.id;
  end if;
  perform set_config('mcrm.discount', '', true);
  insert into public.discount_redemptions (code_id, school_id, student_id, payment_id, enrollment_id, discount)
  values ((r.c).id, p.school_id, p.student_id, p.id, case when (r.c).scope = 'plan' then e.id end, d);
  perform public.audit(p.school_id, 'discount_redeemed', 'payment', p.id,
    jsonb_build_object('code', (r.c).code, 'scope', (r.c).scope, 'discount', d, 'student_id', p.student_id));
  return jsonb_build_object('ok', true, 'discount', d, 'amount', p.amount - d, 'scope', (r.c).scope, 'code', (r.c).code);
end;
$$;

-- Staff apply a permanent code straight to an enrollment (also discounts its pending plan payments). -------------
create or replace function public.redeem_discount_enrollment(p_enrollment_id uuid, p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  e public.enrollments;
  r record;
  q record;
  d integer;
  total integer := 0;
begin
  select * into e from public.enrollments where id = p_enrollment_id for update;
  if not found or not public.is_school_member(e.school_id) then raise exception 'enrollment not found'; end if;
  if not public.rate_limit_hit('discount', auth.uid()::text, 10, 3600) then return jsonb_build_object('error', 'too_many'); end if;
  if e.discount_code is not null then return jsonb_build_object('error', 'has_discount'); end if;
  select * into r from public.discount_lookup(e.school_id, p_code, e.student_id, e.plan_id, false);
  if r.err is not null then return jsonb_build_object('error', r.err); end if;
  if (r.c).scope <> 'plan' then return jsonb_build_object('error', 'payment_only'); end if;

  perform set_config('mcrm.discount', '1', true);
  update public.enrollments set discount_code_id = (r.c).id, discount_code = (r.c).code,
    discount_percent = (r.c).percent, discount_fixed = (r.c).amount
  where id = e.id;
  for q in select id, amount from public.payments
    where enrollment_id = e.id and kind = 'plan' and status = 'pendiente' and discount_amount = 0
      and not exists (select 1 from public.payment_submissions s where s.payment_id = payments.id and s.status = 'pendiente')
  loop
    d := public.discount_of(q.amount, (r.c).percent, (r.c).amount);
    update public.payments set discount_code_id = (r.c).id, discount_code = (r.c).code, discount_amount = d, amount = amount - d,
      status = case when amount - d = 0 then 'pagado'::public.payment_status else status end,
      method = case when amount - d = 0 then 'otro'::public.payment_method else method end
    where id = q.id;
    total := total + d;
  end loop;
  perform set_config('mcrm.discount', '', true);
  insert into public.discount_redemptions (code_id, school_id, student_id, enrollment_id, discount)
  values ((r.c).id, e.school_id, e.student_id, e.id, total);
  perform public.audit(e.school_id, 'discount_redeemed', 'enrollment', e.id,
    jsonb_build_object('code', (r.c).code, 'scope', 'plan', 'student_id', e.student_id));
  return jsonb_build_object('ok', true, 'code', (r.c).code, 'percent', (r.c).percent, 'fixed', (r.c).amount);
end;
$$;

-- Admins undo a discount: on a pending payment (restores the amount) or on an enrollment (later payments go back
-- to full price). Removing it frees the use. ---------------------------------------------------------------------
create or replace function public.remove_discount(p_payment_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p public.payments;
begin
  select * into p from public.payments where id = p_payment_id for update;
  if not found or not public.has_school_role(p.school_id, array['admin']::public.school_role[]) then raise exception 'only admins can remove discounts'; end if;
  if p.discount_amount = 0 then raise exception 'no discount'; end if;
  if p.status <> 'pendiente' and not (p.status = 'pagado' and p.amount = 0) then raise exception 'payment not pending'; end if;
  perform set_config('mcrm.discount', '1', true);
  update public.payments set amount = amount + discount_amount, discount_amount = 0, discount_code_id = null, discount_code = null,
    status = 'pendiente'
  where id = p.id;
  perform set_config('mcrm.discount', '', true);
  -- Frees the use if this payment was the redemption (a permanent code stays on the enrollment).
  delete from public.discount_redemptions where payment_id = p.id and enrollment_id is null;
  perform public.audit(p.school_id, 'discount_removed', 'payment', p.id, jsonb_build_object('code', p.discount_code, 'discount', p.discount_amount));
end;
$$;

create or replace function public.remove_enrollment_discount(p_enrollment_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  e public.enrollments;
begin
  select * into e from public.enrollments where id = p_enrollment_id for update;
  if not found or not public.has_school_role(e.school_id, array['admin']::public.school_role[]) then raise exception 'only admins can remove discounts'; end if;
  if e.discount_code is null then raise exception 'no discount'; end if;
  perform set_config('mcrm.discount', '1', true);
  update public.enrollments set discount_code_id = null, discount_code = null, discount_percent = null, discount_fixed = null where id = e.id;
  perform set_config('mcrm.discount', '', true);
  delete from public.discount_redemptions where enrollment_id = e.id;
  perform public.audit(e.school_id, 'discount_removed', 'enrollment', e.id, jsonb_build_object('code', e.discount_code));
end;
$$;

-- Code changes are logged too.
create or replace function public.discount_codes_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.audit(old.school_id, 'discount_code_deleted', 'discount_code', old.id, jsonb_build_object('code', old.code));
    return old;
  end if;
  perform public.audit(new.school_id, case when tg_op = 'INSERT' then 'discount_code_created' else 'discount_code_changed' end, 'discount_code', new.id,
    jsonb_build_object('code', new.code, 'percent', new.percent, 'amount', new.amount, 'scope', new.scope, 'max_uses', new.max_uses, 'active', new.active));
  return new;
end;
$$;
create trigger discount_codes_audit after insert or update or delete on public.discount_codes
  for each row execute function public.discount_codes_audit();

-- Grants ------------------------------------------------------------------------------------------------------
revoke execute on function public.discount_of(integer, smallint, integer) from public, anon;
grant execute on function public.discount_of(integer, smallint, integer) to authenticated;
revoke execute on function public.discount_lookup(uuid, text, uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.payments_discount_guard() from public, anon, authenticated;
revoke execute on function public.enrollments_discount_guard() from public, anon, authenticated;
revoke execute on function public.discount_codes_uses_guard() from public, anon, authenticated;
revoke execute on function public.discount_codes_audit() from public, anon, authenticated;
revoke execute on function public.discount_code_uses(uuid) from public, anon;
grant execute on function public.discount_code_uses(uuid) to authenticated;
revoke execute on function public.redeem_discount(uuid, text) from public, anon;
grant execute on function public.redeem_discount(uuid, text) to authenticated;
revoke execute on function public.redeem_discount_enrollment(uuid, text) from public, anon;
grant execute on function public.redeem_discount_enrollment(uuid, text) to authenticated;
revoke execute on function public.remove_discount(uuid) from public, anon;
grant execute on function public.remove_discount(uuid) to authenticated;
revoke execute on function public.remove_enrollment_discount(uuid) from public, anon;
grant execute on function public.remove_enrollment_discount(uuid) to authenticated;
