-- Contabilidad → Egresos: everything the school pays out (rent, services, teachers' commissions…), recurring payments
-- and teachers' commissions in two modes:
--   * manual: once a month an admin registers the payment by hand (an expense with that teacher);
--   * automática: rules create the expense on their own. For now two kinds of rule:
--       - fijo: a fixed amount every month (also for any recurring payment not tied to a teacher, e.g. rent);
--       - por_clase: an amount per class the teacher taught in the month (sessions whose day came, not marked
--         "no se realizó"). The expense is created when the month closes, due on the rule's day of the next month.
-- Generated expenses are pending until an admin marks them paid. While pending and not edited by hand they follow
-- their rule (amount, number of classes). A generated expense is cancelled ("anulado"), not deleted, so it is not
-- created again.
-- Security: amounts and commissions are confidential: every table is admin-only (also for reading). Status changes
-- and deletions go to the audit log.

create type public.expense_category as enum ('comision_profesor', 'sueldo', 'arriendo', 'servicios', 'insumos', 'marketing', 'impuestos', 'otro');
create type public.expense_status as enum ('pendiente', 'pagado', 'anulado');
create type public.expense_rule_kind as enum ('fijo', 'por_clase');
create type public.teacher_pay_mode as enum ('manual', 'automatica');

-- How each teacher is paid (no row = manual).
create table public.teacher_pay (
  teacher_id uuid primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  mode public.teacher_pay_mode not null default 'manual',
  updated_at timestamptz not null default now(),
  foreign key (teacher_id, school_id) references public.teachers (id, school_id) on delete cascade
);
create trigger teacher_pay_set_updated_at before update on public.teacher_pay
  for each row execute function public.set_updated_at();
create trigger teacher_pay_school_fixed before update on public.teacher_pay
  for each row execute function public.prevent_school_change();

create table public.expense_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  kind public.expense_rule_kind not null default 'fijo',
  concept text not null check (length(btrim(concept)) between 1 and 120),
  category public.expense_category not null default 'otro',
  teacher_id uuid,
  amount integer not null check (amount > 0 and amount <= 100000000),
  day_of_month smallint not null default 1 check (day_of_month between 1 and 28),
  starts_on date not null default (now() at time zone 'America/Santiago')::date,
  ends_on date,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id),
  foreign key (teacher_id, school_id) references public.teachers (id, school_id) on delete cascade,
  constraint expense_rules_per_class_teacher check (kind <> 'por_clase' or teacher_id is not null),
  constraint expense_rules_dates check (ends_on is null or ends_on >= starts_on)
);
create index expense_rules_school_idx on public.expense_rules (school_id, active);
create index expense_rules_teacher_idx on public.expense_rules (teacher_id) where teacher_id is not null;
create trigger expense_rules_created_by before insert on public.expense_rules
  for each row execute function public.set_created_by();
create trigger expense_rules_set_updated_at before update on public.expense_rules
  for each row execute function public.set_updated_at();
create trigger expense_rules_school_fixed before update on public.expense_rules
  for each row execute function public.prevent_school_change();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  category public.expense_category not null default 'otro',
  concept text not null check (length(btrim(concept)) between 1 and 120),
  amount integer not null check (amount > 0 and amount <= 100000000),
  date date not null default (now() at time zone 'America/Santiago')::date,
  status public.expense_status not null default 'pendiente',
  method public.payment_method,
  paid_at timestamptz,
  paid_by uuid references auth.users (id) on delete set null,
  teacher_id uuid,
  rule_id uuid,
  period date check (period is null or extract(day from period) = 1),
  classes integer check (classes is null or classes >= 0),
  auto boolean not null default false,
  notes text check (notes is null or length(notes) <= 400),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id),
  unique (rule_id, period),
  foreign key (teacher_id, school_id) references public.teachers (id, school_id) on delete set null (teacher_id),
  foreign key (rule_id, school_id) references public.expense_rules (id, school_id) on delete set null (rule_id)
);
create index expenses_school_date_idx on public.expenses (school_id, date desc);
create index expenses_teacher_idx on public.expenses (teacher_id, date desc) where teacher_id is not null;
create trigger expenses_created_by before insert on public.expenses
  for each row execute function public.set_created_by();
create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
create trigger expenses_school_fixed before update on public.expenses
  for each row execute function public.prevent_school_change();

-- Paid stamps when and by whom; back to pending clears it. A hand edit of a generated expense's amount stops it from
-- following its rule. The rule, period and number of classes are set only by the generator.
create or replace function public.expenses_guard()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  by_sync boolean := coalesce(current_setting('mcrm.expense_sync', true), '') = '1';
begin
  if new.status = 'pagado' and (tg_op = 'INSERT' or old.status is distinct from 'pagado') then
    new.paid_at := coalesce(new.paid_at, now());
    new.paid_by := coalesce(auth.uid(), new.paid_by);
  elsif new.status <> 'pagado' then
    new.paid_at := null;
    new.paid_by := null;
  end if;
  if not by_sync then
    if tg_op = 'INSERT' then
      new.rule_id := null; new.period := null; new.classes := null; new.auto := false;
    else
      -- the rule only goes away when the rule itself is deleted (its foreign key sets null here)
      if new.rule_id is null and old.rule_id is not null
         and not exists (select 1 from public.expense_rules where id = old.rule_id) then
        new.rule_id := null;
      else
        new.rule_id := old.rule_id;
      end if;
      new.period := old.period; new.classes := old.classes;
      if new.amount is distinct from old.amount then new.auto := false; else new.auto := old.auto; end if;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.expenses_guard() from public, anon, authenticated;
create trigger expenses_guard before insert or update on public.expenses
  for each row execute function public.expenses_guard();

-- Audit: payments, cancellations and deletions of expenses.
create or replace function public.expenses_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.audit(old.school_id, 'expense_deleted', 'expenses', old.id, jsonb_build_object('concept', old.concept, 'amount', old.amount, 'status', old.status));
    return old;
  end if;
  if tg_op = 'UPDATE' and (new.status is distinct from old.status or (new.status = 'pagado' and new.amount is distinct from old.amount)) then
    perform public.audit(new.school_id, 'expense_' || new.status, 'expenses', new.id, jsonb_build_object('concept', new.concept, 'amount', new.amount, 'from', old.status));
  elsif tg_op = 'INSERT' and new.status = 'pagado' then
    perform public.audit(new.school_id, 'expense_pagado', 'expenses', new.id, jsonb_build_object('concept', new.concept, 'amount', new.amount));
  end if;
  return new;
end;
$$;
revoke execute on function public.expenses_audit() from public, anon, authenticated;
create trigger expenses_audit after insert or update or delete on public.expenses
  for each row execute function public.expenses_audit();

-- Deleting a rule removes its pending generated expenses (paid ones stay, without the rule).
create or replace function public.expense_rules_cleanup()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.expenses where rule_id = old.id and status = 'pendiente' and auto;
  return old;
end;
$$;
revoke execute on function public.expense_rules_cleanup() from public, anon, authenticated;
create trigger expense_rules_cleanup before delete on public.expense_rules
  for each row execute function public.expense_rules_cleanup();

-- RLS: admins only (also reading).
alter table public.teacher_pay enable row level security;
alter table public.expense_rules enable row level security;
alter table public.expenses enable row level security;

create policy teacher_pay_select on public.teacher_pay for select to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy teacher_pay_insert on public.teacher_pay for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy teacher_pay_update on public.teacher_pay for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy teacher_pay_delete on public.teacher_pay for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

create policy expense_rules_select on public.expense_rules for select to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy expense_rules_insert on public.expense_rules for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy expense_rules_update on public.expense_rules for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy expense_rules_delete on public.expense_rules for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

create policy expenses_select on public.expenses for select to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy expenses_insert on public.expenses for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy expenses_update on public.expenses for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
-- Generated expenses are cancelled, not deleted (otherwise the next sync would create them again).
create policy expenses_delete on public.expenses for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]) and rule_id is null);

-- Classes a teacher taught between two dates: sessions whose day came (numbered) and not marked "no se realizó".
create or replace function public.teacher_classes_between(p_teacher_id uuid, p_from date, p_to date)
returns integer language sql stable security invoker set search_path = ''
as $$
  select count(*)::int from public.class_sessions
  where teacher_id = p_teacher_id and date between p_from and p_to and number is not null and not not_held;
$$;
revoke execute on function public.teacher_classes_between(uuid, date, date) from public, anon, authenticated;

-- Creates (and keeps up to date while pending) the expenses of a school's active rules up to today.
create or replace function public.sync_expenses(p_school_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Santiago')::date;
  this_month date := date_trunc('month', (now() at time zone 'America/Santiago')::date)::date;
  r record;
  m date;
  last_m date;
  due date;
  n_classes integer;
  v_amount integer;
  n integer := 0;
begin
  if auth.uid() is not null and not public.has_school_role(p_school_id, array['admin']::public.school_role[]) then
    raise exception 'not allowed';
  end if;
  perform pg_advisory_xact_lock(hashtext('expenses:' || p_school_id::text));
  perform public.sync_class_sessions(p_school_id);
  perform set_config('mcrm.expense_sync', '1', true);

  for r in
    select er.* from public.expense_rules er
    left join public.teacher_pay tp on tp.teacher_id = er.teacher_id
    where er.school_id = p_school_id and er.active
      and (er.teacher_id is null or tp.mode = 'automatica')
  loop
    -- Fixed: up to this month (shown as pending ahead of its day). Per class: only closed months.
    last_m := case when r.kind = 'fijo' then this_month else (this_month - interval '1 month')::date end;
    -- at most 24 months back
    m := greatest(date_trunc('month', r.starts_on)::date, (this_month - interval '24 months')::date);
    while m <= last_m loop
      if r.ends_on is not null and m > r.ends_on then exit; end if;
      if r.kind = 'fijo' then
        due := m + (r.day_of_month - 1);
        n_classes := null;
        v_amount := r.amount;
        if due < r.starts_on or (r.ends_on is not null and due > r.ends_on) then
          m := (m + interval '1 month')::date; continue;
        end if;
      else
        due := (m + interval '1 month')::date + (r.day_of_month - 1);
        n_classes := public.teacher_classes_between(r.teacher_id, greatest(m, r.starts_on),
                       least((m + interval '1 month - 1 day')::date, coalesce(r.ends_on, 'infinity'::date), today));
        v_amount := least(r.amount::bigint * n_classes, 100000000)::int;
      end if;

      if v_amount > 0 then
        insert into public.expenses (school_id, category, concept, amount, date, teacher_id, rule_id, period, classes, auto, created_by)
        values (p_school_id, r.category, r.concept, v_amount, due, r.teacher_id, r.id, m, n_classes, true, null)
        on conflict (rule_id, period) do update
          set amount = excluded.amount, classes = excluded.classes, date = excluded.date, concept = excluded.concept,
              category = excluded.category, teacher_id = excluded.teacher_id
          where public.expenses.status = 'pendiente' and public.expenses.auto
            and (public.expenses.amount, public.expenses.classes, public.expenses.date, public.expenses.concept, public.expenses.category, public.expenses.teacher_id)
                is distinct from (excluded.amount, excluded.classes, excluded.date, excluded.concept, excluded.category, excluded.teacher_id);
        if found then n := n + 1; end if;
      else
        -- no classes (any more): a pending generated expense of that month goes away
        delete from public.expenses where rule_id = r.id and period = m and status = 'pendiente' and auto;
      end if;
      m := (m + interval '1 month')::date;
    end loop;
  end loop;
  perform set_config('mcrm.expense_sync', '', true);
  return n;
end;
$$;
revoke execute on function public.sync_expenses(uuid) from public, anon;
grant execute on function public.sync_expenses(uuid) to authenticated;

create or replace function public.sync_all_expenses()
returns void language plpgsql security definer set search_path = ''
as $$
declare s record;
begin
  for s in select distinct school_id from public.expense_rules where active loop
    perform public.sync_expenses(s.school_id);
  end loop;
end;
$$;
revoke execute on function public.sync_all_expenses() from public, anon, authenticated;

-- The month so far of each per-class rule (admins): classes taught and the amount accrued.
create or replace function public.expense_rules_month(p_school_id uuid)
returns table (rule_id uuid, classes integer, amount bigint)
language plpgsql stable security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Santiago')::date;
  m date := date_trunc('month', (now() at time zone 'America/Santiago')::date)::date;
begin
  if not public.has_school_role(p_school_id, array['admin']::public.school_role[]) then raise exception 'not allowed'; end if;
  return query
    select er.id, c.n, er.amount::bigint * c.n
    from public.expense_rules er
    cross join lateral (select public.teacher_classes_between(er.teacher_id, greatest(m, er.starts_on), least(today, coalesce(er.ends_on, today))) n) c
    where er.school_id = p_school_id and er.kind = 'por_clase';
end;
$$;
revoke execute on function public.expense_rules_month(uuid) from public, anon;
grant execute on function public.expense_rules_month(uuid) to authenticated;
