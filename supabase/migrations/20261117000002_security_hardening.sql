-- Security hardening (OWASP Top 10 2025 / ASVS 5.0 review, 2026-11-17). See docs/security.md.
--  1. Least privilege on functions: nothing in public is executable by anon except the three public RPCs, and
--     trigger/internal functions are not callable through the API at all. New functions are no longer
--     executable by anon/PUBLIC by default.
--  2. Two-step verification (TOTP) enforced in the database: a user who enrolled a factor only reaches data with
--     an aal2 session, so a stolen password alone is not enough (also when calling the API directly).
--  3. Bank transfer data: only the school's CEO changes it (an admin could otherwise redirect payments).
--  4. Audit log of sensitive actions (bank data, payment status, team roles, student deletion).
--  5. Rate limits for anonymous entry points (trial bookings, sign-ups).

-- 2. MFA -------------------------------------------------------------------------------------------------------
create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is null
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;

create or replace function public.is_ceo()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.platform_admins where user_id = auth.uid()) and public.mfa_ok(); $$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.owners where user_id = auth.uid()) and public.mfa_ok(); $$;

create or replace function public.is_school_owner(p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.schools where id = p_school_id and owner_id = auth.uid()) and public.mfa_ok(); $$;

create or replace function public.is_school_member(p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_ceo() or public.is_school_owner(p_school_id) or (exists (
    select 1 from public.school_members where school_id = p_school_id and user_id = auth.uid()
  ) and public.mfa_ok());
$$;

create or replace function public.has_school_role(p_school_id uuid, p_roles public.school_role[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_ceo() or public.is_school_owner(p_school_id) or (exists (
    select 1 from public.school_members where school_id = p_school_id and user_id = auth.uid() and role = any(p_roles)
  ) and public.mfa_ok());
$$;

create or replace function public.is_student_user(p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.students where school_id = p_school_id and user_id = auth.uid() and active) and public.mfa_ok(); $$;

create or replace function public.my_student_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $$ select id from public.students where user_id = auth.uid() and active and public.mfa_ok(); $$;

-- 4. Audit log -------------------------------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  school_id uuid references public.schools (id) on delete cascade,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb
);
create index audit_log_school_idx on public.audit_log (school_id, at desc);
alter table public.audit_log enable row level security;
-- Read: the platform CEO and the school's owner. No one writes directly (only the triggers below).
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.is_ceo() or public.is_school_owner(school_id));

create or replace function public.audit(p_school uuid, p_action text, p_entity text, p_id uuid, p_details jsonb)
returns void language sql security definer set search_path = ''
as $$
  -- Skipped when the school itself is being deleted (cascades would otherwise log every child row).
  insert into public.audit_log (actor, school_id, action, entity, entity_id, details)
  select auth.uid(), p_school, p_action, p_entity, p_id, coalesce(p_details, '{}'::jsonb)
  where exists (select 1 from public.schools where id = p_school);
$$;

-- 3. Bank data: only the CEO/owner changes it, and every change is logged ------------------------------------
create or replace function public.schools_transfer_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  changed boolean := (new.transfer_bank, new.transfer_account_type, new.transfer_account_number, new.transfer_holder, new.transfer_rut, new.transfer_email)
    is distinct from (old.transfer_bank, old.transfer_account_type, old.transfer_account_number, old.transfer_holder, old.transfer_rut, old.transfer_email);
begin
  if not changed then return new; end if;
  if auth.uid() is not null and not (public.is_ceo() or public.is_school_owner(new.id)) then
    raise exception 'only the CEO can change the transfer data';
  end if;
  perform public.audit(new.id, 'transfer_data_changed', 'school', new.id, jsonb_build_object(
    'before', jsonb_build_object('bank', old.transfer_bank, 'type', old.transfer_account_type, 'number', old.transfer_account_number, 'holder', old.transfer_holder, 'rut', old.transfer_rut, 'email', old.transfer_email),
    'after', jsonb_build_object('bank', new.transfer_bank, 'type', new.transfer_account_type, 'number', new.transfer_account_number, 'holder', new.transfer_holder, 'rut', new.transfer_rut, 'email', new.transfer_email)));
  return new;
end;
$$;
create trigger schools_transfer_guard before update on public.schools
  for each row execute function public.schools_transfer_guard();

create or replace function public.payments_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.audit(old.school_id, 'payment_deleted', 'payment', old.id, jsonb_build_object('amount', old.amount, 'status', old.status, 'concept', old.concept, 'student_id', old.student_id));
    return old;
  end if;
  if old.status is distinct from new.status or old.amount is distinct from new.amount then
    perform public.audit(new.school_id, 'payment_changed', 'payment', new.id, jsonb_build_object(
      'status', jsonb_build_array(old.status, new.status), 'amount', jsonb_build_array(old.amount, new.amount), 'concept', new.concept, 'student_id', new.student_id));
  end if;
  return new;
end;
$$;
create trigger payments_audit after update or delete on public.payments
  for each row execute function public.payments_audit();

create or replace function public.members_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit(new.school_id, 'member_added', 'member', new.user_id, jsonb_build_object('role', new.role));
  elsif tg_op = 'DELETE' then
    perform public.audit(old.school_id, 'member_removed', 'member', old.user_id, jsonb_build_object('role', old.role));
    return old;
  elsif old.role is distinct from new.role then
    perform public.audit(new.school_id, 'member_role_changed', 'member', new.user_id, jsonb_build_object('role', jsonb_build_array(old.role, new.role)));
  end if;
  return new;
end;
$$;
create trigger members_audit after insert or update or delete on public.school_members
  for each row execute function public.members_audit();

create or replace function public.students_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.audit(old.school_id, 'student_deleted', 'student', old.id, jsonb_build_object('name', old.full_name));
  return old;
end;
$$;
create trigger students_audit after delete on public.students
  for each row execute function public.students_audit();

-- 5. Rate limits -----------------------------------------------------------------------------------------------
create table public.rate_limits (
  bucket text not null,
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, key, window_start)
);
alter table public.rate_limits enable row level security; -- no policies: only definer functions touch it

-- Counts a hit and says whether it is still within the limit (fixed window).
create or replace function public.rate_limit_hit(p_bucket text, p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  if p_key is null or p_key = '' then return true; end if;
  insert into public.rate_limits as r (bucket, key, window_start, hits) values (p_bucket, p_key, w, 1)
  on conflict (bucket, key, window_start) do update set hits = r.hits + 1
  returning hits into n;
  delete from public.rate_limits where window_start < now() - interval '1 day' and random() < 0.02; -- housekeeping
  return n <= p_max;
end;
$$;

-- Caller IP as seen by the API gateway (null outside an API request).
create or replace function public.request_ip()
returns text language sql stable set search_path = ''
as $$ select nullif(btrim(split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1)), ''); $$;

-- Trial bookings (anonymous): at most 10 per hour per IP.
create or replace function public.trial_bookings_rate_limit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not public.rate_limit_hit('book_trial', public.request_ip(), 10, 3600) then
    raise exception 'rate limited';
  end if;
  return new;
end;
$$;
create trigger trial_bookings_rate_limit before insert on public.trial_bookings
  for each row execute function public.trial_bookings_rate_limit();

-- 1. Least privilege on functions -------------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.prorettype = 'trigger'::regtype as is_trigger
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    -- Keep what authenticated users can call today (explicitly), except triggers.
    if not f.is_trigger and has_function_privilege('authenticated', f.sig, 'execute') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.is_trigger then
      execute format('revoke execute on function %s from authenticated', f.sig);
    end if;
  end loop;
end;
$$;
-- Internal only (service role / cron / other functions), never from the API.
revoke execute on function public.audit(uuid, text, text, uuid, jsonb) from authenticated;
revoke execute on function public.rate_limit_hit(text, text, integer, integer) from authenticated;
revoke execute on function public.request_ip() from authenticated;
-- The public RPCs (landing page, trial booking, student public profile).
grant execute on function public.school_landing(text) to anon;
grant execute on function public.student_public_profile(text, text) to anon;
grant execute on function public.book_trial(text, uuid, date, text, text, text, text) to anon;
-- From now on new functions are not executable by anon/PUBLIC unless granted explicitly.
alter default privileges revoke execute on functions from public; -- global default (cannot be revoked per schema)
alter default privileges in schema public revoke execute on functions from anon;
