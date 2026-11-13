-- Student self-signup through a per-school link (/registro/<code>).
-- The Edge Function student-signup creates the account (public sign-up stays disabled) and calls
-- register_student_signup(): if RUT + email match an active student of that school without an account, the
-- account is linked right away; otherwise a pending request is left for an admin to link, create or reject.

-- 1. Per-school link -----------------------------------------------------------------------------------------
create or replace function public.new_signup_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- 10 chars without look-alikes (0/O, 1/l/I)
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 10);
$$;

alter table public.schools
  add column signup_code text unique default public.new_signup_code(),
  add column signup_enabled boolean not null default false;
update public.schools set signup_code = public.new_signup_code() where signup_code is null;
alter table public.schools alter column signup_code set not null;

-- Public: the sign-up page shows which school it is. Only when the link is enabled; no other data.
create or replace function public.signup_school(p_code text)
returns table (id uuid, name text, logo_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.logo_url from public.schools s where s.signup_code = p_code and s.signup_enabled;
$$;
grant execute on function public.signup_school(text) to anon, authenticated;

create or replace function public.regenerate_signup_code(p_school_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare code text;
begin
  if not public.has_school_role(p_school_id, array['admin']::public.school_role[]) then
    raise exception 'only admins can change the sign-up link';
  end if;
  update public.schools set signup_code = public.new_signup_code() where id = p_school_id returning signup_code into code;
  return code;
end;
$$;
revoke execute on function public.regenerate_signup_code(uuid) from public, anon;
grant execute on function public.regenerate_signup_code(uuid) to authenticated;

-- 2. Requests ------------------------------------------------------------------------------------------------
create type public.signup_status as enum ('pendiente', 'aprobada', 'rechazada');

create table public.student_signups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  first_name text not null check (length(btrim(first_name)) between 1 and 60),
  first_last_name text not null check (length(btrim(first_last_name)) between 1 and 60),
  rut text not null constraint student_signups_rut_valid check (public.rut_is_valid(rut)),
  email text not null,
  phone text check (phone is null or length(phone) <= 30),
  status public.signup_status not null default 'pendiente',
  student_id uuid references public.students (id) on delete set null,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);
create index student_signups_school_status_idx on public.student_signups (school_id, status, created_at);

alter table public.student_signups enable row level security;
-- Admins of the school see requests; the applicant sees their own (to show "pending"). Writes only via RPCs.
create policy student_signups_select on public.student_signups for select to authenticated
  using (user_id = auth.uid() or public.has_school_role(school_id, array['admin']::public.school_role[]));

create or replace function public.rut_key(p_rut text)
returns text
language sql
immutable
set search_path = ''
as $$ select nullif(regexp_replace(upper(coalesce(p_rut, '')), '[^0-9K]', '', 'g'), ''); $$;

-- Called by the Edge Function (service role) right after creating the account.
create or replace function public.register_student_signup(
  p_code text, p_user_id uuid, p_first_name text, p_first_last_name text, p_rut text, p_email text, p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sc record;
  match uuid;
  req uuid;
  k text := public.rut_key(p_rut);
  v_rut text;
begin
  if auth.uid() is not null then raise exception 'not allowed'; end if; -- service role only
  if k is null or length(k) < 2 then raise exception 'invalid rut'; end if;
  v_rut := left(k, length(k) - 1) || '-' || right(k, 1); -- canonical 12345678-5
  select id into sc from public.schools where signup_code = p_code and signup_enabled;
  if not found then raise exception 'invalid sign-up link'; end if;

  -- Auto-link only when RUT AND email both match one active student that has no account yet.
  select s.id into match from public.students s
  where s.school_id = sc.id and s.active and s.user_id is null
    and public.rut_key(s.rut) = k
    and lower(btrim(s.email)) = lower(btrim(p_email))
  limit 1;

  insert into public.student_signups (school_id, user_id, first_name, first_last_name, rut, email, phone, status, student_id, decided_at)
  values (sc.id, p_user_id, btrim(p_first_name), btrim(p_first_last_name), v_rut, lower(btrim(p_email)), nullif(btrim(p_phone), ''),
          (case when match is null then 'pendiente' else 'aprobada' end)::public.signup_status, match, case when match is null then null else now() end)
  returning id into req;

  if match is not null then
    update public.students set user_id = p_user_id where id = match;
  end if;
  return jsonb_build_object('linked', match is not null, 'request_id', req);
end;
$$;
revoke execute on function public.register_student_signup(text, uuid, text, text, text, text, text) from public, anon, authenticated;

-- Admin decision: link to an existing student, create a new student from the request, or reject.
create or replace function public.decide_student_signup(p_id uuid, p_action text, p_student_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.student_signups;
  sid uuid;
begin
  select * into r from public.student_signups where id = p_id;
  if not found then raise exception 'request not found'; end if;
  if not public.has_school_role(r.school_id, array['admin']::public.school_role[]) then
    raise exception 'only admins can approve sign-ups';
  end if;
  if r.status <> 'pendiente' then raise exception 'request already decided'; end if;

  if p_action = 'link' then
    update public.students set user_id = r.user_id
    where id = p_student_id and school_id = r.school_id and user_id is null
    returning id into sid;
    if sid is null then raise exception 'student not available'; end if;
  elsif p_action = 'create' then
    insert into public.students (school_id, first_name, first_last_name, rut, email, phone, user_id)
    values (r.school_id, r.first_name, r.first_last_name, r.rut, r.email, r.phone, r.user_id)
    returning id into sid;
  elsif p_action = 'reject' then
    sid := null;
  else
    raise exception 'unknown action';
  end if;

  update public.student_signups
  set status = case when p_action = 'reject' then 'rechazada'::public.signup_status else 'aprobada' end,
      student_id = sid, decided_by = auth.uid(), decided_at = now()
  where id = r.id;
  return sid;
end;
$$;
revoke execute on function public.decide_student_signup(uuid, text, uuid) from public, anon;
grant execute on function public.decide_student_signup(uuid, text, uuid) to authenticated;
