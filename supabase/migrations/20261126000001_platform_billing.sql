-- Paying Martial CRM (2026-11-26). The CEO (a customer, `owners`) pays the subscription the same way students pay
-- their school: bank transfer to the platform's account, "Ya transferí", and the platform operator confirms it.
--   * platform_settings: the platform's transfer data (operator edits it; customers see it only through
--     my_subscription()).
--   * platform_invoices: one charge per period. The customer opens it for a plan (subscription_checkout), may apply
--     a discount code, reports the transfer; the operator approves it (→ the subscription is active until the
--     invoice's period end, on that plan) or rejects it (back to pending, with a reason).
--   * platform_discount_codes: the operator's codes, like the schools' codes: % or fixed amount, one charge ('pago')
--     or every charge of the subscription ('plan'), optional plan, uses and dates. One use per customer.
--   * A new monthly plan of $20.000.
-- Security (OWASP A01/A04/A07): customers never read the codes, other customers' invoices or the plan table; every
-- write goes through security-definer functions that check who is calling; code tries are rate limited; the
-- operator needs a two-step-verified session (is_platform_operator()); every payment is in subscription_events.

-- 1. The platform's transfer data (one row) -----------------------------------------------------------------------
create table public.platform_settings (
  id boolean primary key default true check (id),
  transfer_bank text check (transfer_bank is null or length(btrim(transfer_bank)) between 1 and 60),
  transfer_account_type text check (transfer_account_type is null or length(btrim(transfer_account_type)) between 1 and 40),
  transfer_account_number text check (transfer_account_number is null or length(btrim(transfer_account_number)) between 1 and 40),
  transfer_holder text check (transfer_holder is null or length(btrim(transfer_holder)) between 1 and 80),
  transfer_rut text check (transfer_rut is null or length(btrim(transfer_rut)) between 1 and 20),
  transfer_email text check (transfer_email is null or length(btrim(transfer_email)) between 3 and 120),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.platform_settings default values;
alter table public.platform_settings enable row level security;
create policy platform_settings_select on public.platform_settings for select to authenticated using (public.is_platform_operator());
create policy platform_settings_update on public.platform_settings for update to authenticated
  using (public.is_platform_operator()) with check (public.is_platform_operator());
revoke all on public.platform_settings from anon;
revoke insert, delete on public.platform_settings from authenticated;
grant select, update on public.platform_settings to authenticated;

create or replace function public.platform_settings_stamp()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end; $$;
revoke execute on function public.platform_settings_stamp() from public, anon, authenticated;
create trigger platform_settings_stamp before update on public.platform_settings
  for each row execute function public.platform_settings_stamp();

-- 2. The $20.000 monthly plan --------------------------------------------------------------------------------------
insert into public.platform_plans (name, price_clp, period, max_schools, max_students)
values ('Mensual', 20000, 'mensual', null, null);

-- 3. Discount codes ------------------------------------------------------------------------------------------------
create table public.platform_discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{2,23}$'),
  description text check (description is null or length(description) <= 200),
  percent smallint check (percent between 1 and 100),
  amount integer check (amount between 1 and 100000000),
  scope public.discount_scope not null default 'pago',
  plan_id uuid references public.platform_plans (id) on delete set null,
  max_uses integer check (max_uses between 1 and 100000),
  valid_from date,
  valid_until date,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_discount_codes_one_value check ((percent is null) <> (amount is null)),
  constraint platform_discount_codes_dates check (valid_until is null or valid_from is null or valid_until >= valid_from)
);
create trigger platform_discount_codes_updated_at before update on public.platform_discount_codes
  for each row execute function public.set_updated_at();
alter table public.platform_discount_codes enable row level security;
create policy platform_discount_codes_operator on public.platform_discount_codes for all to authenticated
  using (public.is_platform_operator()) with check (public.is_platform_operator());
revoke all on public.platform_discount_codes from anon;
grant select, insert, update, delete on public.platform_discount_codes to authenticated;

-- 4. Charges (invoices) ----------------------------------------------------------------------------------------------
create type public.platform_invoice_status as enum ('pendiente', 'por_confirmar', 'pagada', 'anulada');

create table public.platform_invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (user_id) on delete cascade,
  plan_id uuid references public.platform_plans (id) on delete set null,
  plan_name text not null,
  period text not null check (period in ('mensual', 'anual')),
  period_start date not null,
  period_end date not null,
  base_amount integer not null check (base_amount >= 0),
  discount_code_id uuid references public.platform_discount_codes (id) on delete set null,
  discount_code text,
  discount_amount integer not null default 0 check (discount_amount >= 0),
  amount integer not null check (amount >= 0),
  status public.platform_invoice_status not null default 'pendiente',
  reference text check (reference is null or length(reference) <= 120),
  reported_at timestamptz,
  reject_reason text check (reject_reason is null or length(reject_reason) <= 200),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint platform_invoices_period check (period_end >= period_start)
);
-- One open charge per customer at a time.
create unique index platform_invoices_one_open on public.platform_invoices (owner_id) where status in ('pendiente', 'por_confirmar');
create index platform_invoices_owner_idx on public.platform_invoices (owner_id, created_at desc);
create index platform_invoices_status_idx on public.platform_invoices (status, reported_at desc);
alter table public.platform_invoices enable row level security;
create policy platform_invoices_select on public.platform_invoices for select to authenticated
  using (owner_id = auth.uid() or public.is_platform_operator());
revoke all on public.platform_invoices from anon;
revoke insert, update, delete on public.platform_invoices from authenticated;
grant select on public.platform_invoices to authenticated;

create table public.platform_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.platform_discount_codes (id) on delete restrict,
  owner_id uuid not null references public.owners (user_id) on delete cascade,
  invoice_id uuid references public.platform_invoices (id) on delete cascade,
  discount integer not null default 0 check (discount >= 0),
  created_at timestamptz not null default now(),
  unique (code_id, owner_id)
);
alter table public.platform_redemptions enable row level security;
create policy platform_redemptions_operator on public.platform_redemptions for select to authenticated using (public.is_platform_operator());
revoke all on public.platform_redemptions from anon;
revoke insert, update, delete on public.platform_redemptions from authenticated;
grant select on public.platform_redemptions to authenticated;

-- A permanent code ('plan') stays on the subscription and discounts every later charge.
alter table public.subscriptions
  add column discount_code_id uuid references public.platform_discount_codes (id) on delete set null,
  add column discount_code text,
  add column discount_percent smallint check (discount_percent between 1 and 100),
  add column discount_fixed integer check (discount_fixed > 0);

-- 5. Helpers -------------------------------------------------------------------------------------------------------
-- The caller is a customer (owner) with a verified session when MFA is on. A suspended customer still passes: paying
-- is how they get back in.
create or replace function public.billing_owner_ok()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.owners where user_id = auth.uid()) and public.mfa_ok(); $$;
revoke execute on function public.billing_owner_ok() from public, anon, authenticated;

-- A paid (or fully discounted) charge activates the subscription on its plan until its period end.
create or replace function public.platform_finalize_invoice(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  i public.platform_invoices;
  old public.subscriptions;
begin
  update public.platform_invoices set status = 'pagada', decided_by = auth.uid(), decided_at = now(), reject_reason = null
  where id = p_id and status in ('pendiente', 'por_confirmar')
  returning * into i;
  if not found then raise exception 'invoice not open'; end if;
  insert into public.subscriptions (owner_id) values (i.owner_id) on conflict do nothing;
  select * into old from public.subscriptions where owner_id = i.owner_id for update;
  update public.subscriptions
  set plan_id = coalesce(i.plan_id, plan_id), status = 'activa', trial_ends = null,
      period_end = greatest(coalesce(period_end, i.period_end), i.period_end), updated_at = now(), updated_by = auth.uid()
  where owner_id = i.owner_id;
  insert into public.subscription_events (owner_id, actor, details)
  values (i.owner_id, auth.uid(), jsonb_build_object(
    'payment', jsonb_build_object('amount', i.amount, 'plan', i.plan_name, 'until', i.period_end, 'code', i.discount_code),
    'status', jsonb_build_array(old.status, 'activa')));
end;
$$;
revoke execute on function public.platform_finalize_invoice(uuid) from public, anon, authenticated;

-- Validates a code for a customer and a plan. Returns the code or an error key.
create or replace function public.platform_code_lookup(p_code text, p_owner uuid, p_plan uuid, out c public.platform_discount_codes, out err text)
language plpgsql security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Santiago')::date;
  used integer;
begin
  select * into c from public.platform_discount_codes
    where code = upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g')) for update;
  if not found or not c.active then err := 'invalid'; return; end if;
  if c.valid_from is not null and today < c.valid_from then err := 'not_yet'; return; end if;
  if c.valid_until is not null and today > c.valid_until then err := 'expired'; return; end if;
  if exists (select 1 from public.platform_redemptions where code_id = c.id and owner_id = p_owner) then err := 'used'; return; end if;
  select count(*) into used from public.platform_redemptions where code_id = c.id;
  if c.max_uses is not null and used >= c.max_uses then err := 'exhausted'; return; end if;
  if c.plan_id is not null and c.plan_id is distinct from p_plan then err := 'plan'; return; end if;
end;
$$;
revoke execute on function public.platform_code_lookup(text, uuid, uuid) from public, anon, authenticated;

-- 6. The customer ---------------------------------------------------------------------------------------------------
-- Everything "Mi suscripción" shows: plan, status, dates, usage against the plan's limits, the plans to choose from,
-- the platform's transfer data, the open charge and the last charges.
create or replace function public.my_subscription()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  sub public.subscriptions;
  pl public.platform_plans;
  st public.platform_settings;
begin
  if not public.billing_owner_ok() then raise exception 'not allowed'; end if;
  select * into sub from public.subscriptions where owner_id = me;
  select * into pl from public.platform_plans where id = sub.plan_id;
  select * into st from public.platform_settings where id;
  return jsonb_build_object(
    'status', sub.status, 'trial_ends', sub.trial_ends, 'period_end', sub.period_end,
    'plan', case when pl.id is null then null else jsonb_build_object('id', pl.id, 'name', pl.name, 'price_clp', pl.price_clp,
      'period', pl.period, 'max_schools', pl.max_schools, 'max_students', pl.max_students) end,
    'discount', case when sub.discount_code is null then null else jsonb_build_object('code', sub.discount_code,
      'percent', sub.discount_percent, 'fixed', sub.discount_fixed) end,
    'usage', jsonb_build_object(
      'schools', (select count(*) from public.schools where owner_id = me),
      'students', (select count(*) from public.students s join public.schools sc on sc.id = s.school_id where sc.owner_id = me and s.active)),
    'plans', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'price_clp', p.price_clp, 'period', p.period,
      'max_schools', p.max_schools, 'max_students', p.max_students) order by p.price_clp)
      from public.platform_plans p where p.active and p.price_clp > 0), '[]'::jsonb),
    'transfer', case when st.transfer_account_number is null then null else jsonb_build_object('bank', st.transfer_bank,
      'account_type', st.transfer_account_type, 'account_number', st.transfer_account_number, 'holder', st.transfer_holder,
      'rut', st.transfer_rut, 'email', st.transfer_email) end,
    'invoices', coalesce((select jsonb_agg(to_jsonb(i) - 'owner_id' - 'decided_by' - 'discount_code_id' order by i.created_at desc)
      from (select * from public.platform_invoices where owner_id = me order by created_at desc limit 24) i), '[]'::jsonb)
  );
end;
$$;

-- Opens (or re-opens for another plan) the charge for the next period. The period starts the day after the paid
-- period ends, or today.
create or replace function public.subscription_checkout(p_plan uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'America/Santiago')::date;
  pl public.platform_plans;
  sub public.subscriptions;
  open_inv public.platform_invoices;
  start_d date;
  base integer;
  d integer := 0;
  new_id uuid;
begin
  if not public.billing_owner_ok() then raise exception 'not allowed'; end if;
  select * into pl from public.platform_plans where id = p_plan and active and price_clp > 0;
  if not found then raise exception 'plan not available'; end if;
  insert into public.subscriptions (owner_id) values (me) on conflict do nothing;
  select * into sub from public.subscriptions where owner_id = me for update;
  select * into open_inv from public.platform_invoices where owner_id = me and status in ('pendiente', 'por_confirmar');
  if found then
    if open_inv.status = 'por_confirmar' then raise exception 'in review'; end if;
    if open_inv.plan_id = p_plan then return open_inv.id; end if;
    delete from public.platform_invoices where id = open_inv.id; -- its one-off code use goes with it
  end if;
  start_d := case when sub.status = 'activa' and sub.period_end is not null and sub.period_end >= today then sub.period_end + 1 else today end;
  base := pl.price_clp;
  if sub.discount_code is not null and (sub.discount_code_id is null
       or (select plan_id from public.platform_discount_codes where id = sub.discount_code_id) is null
       or (select plan_id from public.platform_discount_codes where id = sub.discount_code_id) = pl.id) then
    d := public.discount_of(base, sub.discount_percent, sub.discount_fixed);
  end if;
  insert into public.platform_invoices (owner_id, plan_id, plan_name, period, period_start, period_end, base_amount,
    discount_code, discount_amount, amount)
  values (me, pl.id, pl.name, pl.period, start_d,
    (start_d + case when pl.period = 'anual' then interval '1 year' else interval '1 month' end - interval '1 day')::date,
    base, case when d > 0 then sub.discount_code end, d, base - d)
  returning id into new_id;
  if base - d = 0 then perform public.platform_finalize_invoice(new_id); end if;
  return new_id;
end;
$$;

-- Applies a discount code to the open charge (10 tries per hour per customer).
create or replace function public.subscription_apply_code(p_code text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  i public.platform_invoices;
  r record;
  d integer;
begin
  if not public.billing_owner_ok() then raise exception 'not allowed'; end if;
  if not public.rate_limit_hit('platform_discount', me::text, 10, 3600) then return jsonb_build_object('error', 'too_many'); end if;
  select * into i from public.platform_invoices where owner_id = me and status in ('pendiente', 'por_confirmar') for update;
  if not found then return jsonb_build_object('error', 'no_invoice'); end if;
  if i.status = 'por_confirmar' then return jsonb_build_object('error', 'in_review'); end if;
  if i.discount_amount > 0 then return jsonb_build_object('error', 'has_discount'); end if;
  select * into r from public.platform_code_lookup(p_code, me, i.plan_id);
  if r.err is not null then return jsonb_build_object('error', r.err); end if;
  d := public.discount_of(i.base_amount, (r.c).percent, (r.c).amount);
  update public.platform_invoices set discount_code_id = (r.c).id, discount_code = (r.c).code, discount_amount = d, amount = base_amount - d
  where id = i.id;
  insert into public.platform_redemptions (code_id, owner_id, invoice_id, discount) values ((r.c).id, me, i.id, d);
  if (r.c).scope = 'plan' then
    update public.subscriptions set discount_code_id = (r.c).id, discount_code = (r.c).code,
      discount_percent = (r.c).percent, discount_fixed = (r.c).amount, updated_at = now()
    where owner_id = me;
  end if;
  insert into public.subscription_events (owner_id, actor, details)
  values (me, me, jsonb_build_object('code', jsonb_build_object('code', (r.c).code, 'discount', d, 'scope', (r.c).scope)));
  if i.base_amount - d = 0 then perform public.platform_finalize_invoice(i.id); end if;
  return jsonb_build_object('ok', true, 'discount', d, 'amount', i.base_amount - d, 'scope', (r.c).scope, 'code', (r.c).code);
end;
$$;

-- "Ya transferí": the open charge waits for the operator.
create or replace function public.subscription_report_transfer(p_reference text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if not public.billing_owner_ok() then raise exception 'not allowed'; end if;
  if p_reference is not null and length(btrim(p_reference)) > 120 then raise exception 'reference too long'; end if;
  if not exists (select 1 from public.platform_settings where id and transfer_account_number is not null) then
    raise exception 'transfer not configured';
  end if;
  update public.platform_invoices
  set status = 'por_confirmar', reported_at = now(), reference = nullif(btrim(p_reference), ''), reject_reason = null
  where owner_id = me and status = 'pendiente' and amount > 0;
  if not found then raise exception 'no open invoice'; end if;
end;
$$;

-- 7. The operator ---------------------------------------------------------------------------------------------------
create or replace function public.platform_invoices_list(p_limit integer default 100)
returns table (id uuid, owner_id uuid, customer text, email text, plan_name text, period_start date, period_end date,
  base_amount integer, discount_code text, discount_amount integer, amount integer, status public.platform_invoice_status,
  reference text, reported_at timestamptz, reject_reason text, decided_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_operator() then raise exception 'not allowed'; end if;
  return query
  select i.id, i.owner_id, coalesce(nullif(p.full_name, ''), u.email::text), u.email::text, i.plan_name, i.period_start, i.period_end,
         i.base_amount, i.discount_code, i.discount_amount, i.amount, i.status, i.reference, i.reported_at, i.reject_reason,
         i.decided_at, i.created_at
  from public.platform_invoices i
  left join public.profiles p on p.id = i.owner_id
  left join auth.users u on u.id = i.owner_id
  order by (i.status = 'por_confirmar') desc, coalesce(i.reported_at, i.created_at) desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

create or replace function public.platform_decide_invoice(p_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_platform_operator() then raise exception 'not allowed'; end if;
  if p_approve then
    perform public.platform_finalize_invoice(p_id);
  else
    update public.platform_invoices
    set status = 'pendiente', reported_at = null, reject_reason = left(nullif(btrim(p_reason), ''), 200), decided_by = auth.uid(), decided_at = now()
    where id = p_id and status = 'por_confirmar';
    if not found then raise exception 'invoice not in review'; end if;
  end if;
end;
$$;

create or replace function public.platform_discount_uses()
returns table (code_id uuid, uses integer, saved bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_operator() then raise exception 'not allowed'; end if;
  return query select r.code_id, count(*)::integer, coalesce(sum(r.discount), 0)::bigint from public.platform_redemptions r group by r.code_id;
end;
$$;

-- 8. Grants (default privileges give EXECUTE to no one) -------------------------------------------------------------
revoke execute on function public.my_subscription(), public.subscription_checkout(uuid), public.subscription_apply_code(text),
  public.subscription_report_transfer(text), public.platform_invoices_list(integer), public.platform_decide_invoice(uuid, boolean, text),
  public.platform_discount_uses() from public, anon;
grant execute on function public.my_subscription(), public.subscription_checkout(uuid), public.subscription_apply_code(text),
  public.subscription_report_transfer(text), public.platform_invoices_list(integer), public.platform_decide_invoice(uuid, boolean, text),
  public.platform_discount_uses() to authenticated;
