-- A permanent (plan) code used on a payment that is not a plan payment says so, before "es para otro plan".
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
  if c.scope = 'plan' and p_no_plan then err := 'plan_only'; return; end if;
  if c.plan_id is not null and c.plan_id is distinct from p_plan then err := 'plan'; return; end if;
end;
$$;
revoke execute on function public.discount_lookup(uuid, text, uuid, uuid, boolean) from public, anon, authenticated;
