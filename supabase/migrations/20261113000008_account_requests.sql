-- Open sign-up on the site (replaces the per-school link from 20261113000007).
-- Anyone creates an account choosing WHAT for (student or staff member) and WHICH school. Nothing is linked
-- automatically: every request lands in "Pendientes" for the CEO (and the school's admins) to approve or reject.
-- Approving a student links/creates their student record; approving a member adds them to the school.
-- Students then complete their own profile (update_my_student).

-- 1. Drop the link-based flow -----------------------------------------------------------------------------
drop function if exists public.register_student_signup(text, uuid, text, text, text, text, text);
drop function if exists public.decide_student_signup(uuid, text, uuid);
drop function if exists public.signup_school(text);
drop function if exists public.regenerate_signup_code(uuid);
drop table if exists public.student_signups;
drop type if exists public.signup_status;
alter table public.schools drop column if exists signup_code, drop column if exists signup_enabled;
drop function if exists public.new_signup_code();

-- 2. Requests ---------------------------------------------------------------------------------------------
create type public.request_kind as enum ('alumno', 'miembro');
create type public.request_status as enum ('pendiente', 'aprobada', 'rechazada');

create table public.account_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.request_kind not null,
  first_name text not null check (length(btrim(first_name)) between 1 and 60),
  first_last_name text not null check (length(btrim(first_last_name)) between 1 and 60),
  rut text constraint account_requests_rut_valid check (public.rut_is_valid(rut)),
  email text not null,
  phone text check (phone is null or length(phone) <= 30),
  status public.request_status not null default 'pendiente',
  student_id uuid references public.students (id) on delete set null,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (school_id, user_id, kind),
  constraint account_requests_student_rut check (kind <> 'alumno' or rut is not null)
);
create index account_requests_status_idx on public.account_requests (status, created_at);

alter table public.account_requests enable row level security;
-- The applicant sees their own; the CEO and the school's admins see the school's. Writes only via RPCs.
create policy account_requests_select on public.account_requests for select to authenticated
  using (user_id = auth.uid() or public.has_school_role(school_id, array['admin']::public.school_role[]));

-- Public list of schools for the sign-up form (name and city only).
create or replace function public.public_schools()
returns table (id uuid, name text, city text)
language sql
stable
security definer
set search_path = ''
as $$ select s.id, s.name, s.city from public.schools s order by s.name; $$;
grant execute on function public.public_schools() to anon, authenticated;

-- Called by the Edge Function account-signup (service role) right after creating the account.
create or replace function public.register_account_request(
  p_school_id uuid, p_user_id uuid, p_kind public.request_kind,
  p_first_name text, p_first_last_name text, p_rut text, p_email text, p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text := public.rut_key(p_rut);
  req uuid;
begin
  if auth.uid() is not null then raise exception 'not allowed'; end if; -- service role only
  if not exists (select 1 from public.schools where id = p_school_id) then raise exception 'school not found'; end if;
  insert into public.account_requests (school_id, user_id, kind, first_name, first_last_name, rut, email, phone)
  values (p_school_id, p_user_id, p_kind, btrim(p_first_name), btrim(p_first_last_name),
          case when k is null then null else left(k, length(k) - 1) || '-' || right(k, 1) end,
          lower(btrim(p_email)), nullif(btrim(p_phone), ''))
  returning id into req;
  return req;
end;
$$;
revoke execute on function public.register_account_request(uuid, uuid, public.request_kind, text, text, text, text, text) from public, anon, authenticated;

-- Decide a request. Students: link to p_student_id (an existing record without account) or create a new one.
-- Members: join the school with p_role.
create or replace function public.decide_account_request(
  p_id uuid, p_approve boolean, p_student_id uuid default null, p_role public.school_role default 'user'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.account_requests;
  sid uuid;
begin
  select * into r from public.account_requests where id = p_id;
  if not found then raise exception 'request not found'; end if;
  if not public.has_school_role(r.school_id, array['admin']::public.school_role[]) then
    raise exception 'only the CEO or school admins can decide requests';
  end if;
  if r.status <> 'pendiente' then raise exception 'request already decided'; end if;

  if p_approve and r.kind = 'alumno' then
    if p_student_id is not null then
      update public.students set user_id = r.user_id
      where id = p_student_id and school_id = r.school_id and user_id is null
      returning id into sid;
      if sid is null then raise exception 'student not available'; end if;
    else
      insert into public.students (school_id, first_name, first_last_name, rut, email, phone, user_id)
      values (r.school_id, r.first_name, r.first_last_name, r.rut, r.email, r.phone, r.user_id)
      returning id into sid;
    end if;
  elsif p_approve and r.kind = 'miembro' then
    insert into public.school_members (school_id, user_id, role) values (r.school_id, r.user_id, p_role)
    on conflict (school_id, user_id) do nothing;
  end if;

  update public.account_requests
  set status = case when p_approve then 'aprobada'::public.request_status else 'rechazada' end,
      student_id = sid, decided_by = auth.uid(), decided_at = now()
  where id = r.id;
  return sid;
end;
$$;
revoke execute on function public.decide_account_request(uuid, boolean, uuid, public.school_role) from public, anon;
grant execute on function public.decide_account_request(uuid, boolean, uuid, public.school_role) to authenticated;

-- 3. Students complete their own profile (contact, emergency, health) -------------------------------------
create or replace function public.update_my_student(
  p_student_id uuid, p_phone text, p_birth_date date, p_address text,
  p_emergency_contact text, p_emergency_phone text, p_medical_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.students set
    phone = nullif(btrim(p_phone), ''), birth_date = p_birth_date, address = nullif(btrim(p_address), ''),
    emergency_contact = nullif(btrim(p_emergency_contact), ''), emergency_phone = nullif(btrim(p_emergency_phone), ''),
    medical_notes = nullif(btrim(p_medical_notes), '')
  where id = p_student_id and user_id = auth.uid() and active;
  if not found then raise exception 'not your student record'; end if;
end;
$$;
revoke execute on function public.update_my_student(uuid, text, date, text, text, text, text) from public, anon;
grant execute on function public.update_my_student(uuid, text, date, text, text, text, text) to authenticated;
