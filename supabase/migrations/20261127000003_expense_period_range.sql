-- Egresos: the period an expense pays for (e.g. a teacher's manual payment for January, or for 1–15 March).
-- period_from / period_to: both or neither, to on or after from. A generated expense always covers its rule's month
-- (set by the guard, not editable); a hand-made one takes whatever the admin chooses.

alter table public.expenses
  add column period_from date,
  add column period_to date,
  add constraint expenses_period_range check ((period_from is null) = (period_to is null) and (period_to is null or period_to >= period_from));

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
  -- A generated expense covers its month.
  if new.period is not null then
    new.period_from := new.period;
    new.period_to := (new.period + interval '1 month - 1 day')::date;
  end if;
  return new;
end;
$$;
revoke execute on function public.expenses_guard() from public, anon, authenticated;

-- Existing generated expenses get their month (the guard fills it in).
update public.expenses set period_from = period where period is not null;
