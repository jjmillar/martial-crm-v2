-- Apoderados: a student account can also be the guardian of other students (their children).
--  * The guardian asks for a child with the same data as any student; the school's CEO/admin approves it and the
--    child becomes a normal student record with no account of its own (user_id null) linked to the guardian.
--  * Everything a student can do for themselves the guardian can do for the child: see level, attendance, plan
--    and payments, mark attendance (pending approval, like any self check-in), edit the record and the public
--    profile, which starts private.
--  * When the child grows up the guardian hands over the account: a one-time code (7 days) lets the child create
--    their own login; the student record (attendance, XP, payments) stays the same and the guardian link ends.
-- Security: every new function checks the caller explicitly, nothing is anon-callable, codes are stored hashed,
-- the claim from the sign-up page runs only with the service role (Edge Function, rate limited per IP).

-- 1. Guardian links -----------------------------------------------------------------------------------------------
create table public.student_guardians (
  student_id uuid not null references public.students (id) on delete cascade,
  guardian_id uuid not null references auth.users (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, guardian_id)
);
create index student_guardians_guardian_idx on public.student_guardians (guardian_id);
alter table public.student_guardians enable row level security;
revoke all on public.student_guardians from anon;
revoke insert, update, delete on public.student_guardians from authenticated;
grant select on public.student_guardians to authenticated;

-- Children of the signed-in guardian (active, verified session, school not blocked).
create or replace function public.my_ward_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select g.student_id from public.student_guardians g join public.students s on s.id = g.student_id
  where g.guardian_id = auth.uid() and s.active and public.mfa_ok() and not public.school_blocked(s.school_id);
$$;

create policy student_guardians_select on public.student_guardians for select to authenticated
  using ((guardian_id = auth.uid() and public.mfa_ok()) or public.is_school_member(school_id));

-- The student helpers now cover the children too: own record + wards.
create or replace function public.my_student_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select id from public.students where user_id = auth.uid() and active and public.mfa_ok() and not public.school_blocked(school_id)
  union
  select public.my_ward_ids();
$$;

-- A guardian whose own record is inactive (stopped training) still reaches the school of their children.
create or replace function public.is_student_user(p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.mfa_ok() and not public.school_blocked(p_school_id) and (
    exists (select 1 from public.students where school_id = p_school_id and user_id = auth.uid() and active)
    or exists (select 1 from public.student_guardians g join public.students s on s.id = g.student_id
               where g.guardian_id = auth.uid() and g.school_id = p_school_id and s.active));
$$;

create policy students_select_ward on public.students for select to authenticated
  using (id in (select public.my_ward_ids()));

-- 2. Child requests -----------------------------------------------------------------------------------------------
create table public.child_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  guardian_id uuid not null references auth.users (id) on delete cascade,
  first_name text not null check (length(first_name) between 1 and 60),
  middle_name text check (middle_name is null or length(middle_name) <= 60),
  first_last_name text not null check (length(first_last_name) between 1 and 60),
  second_last_name text not null check (length(second_last_name) between 1 and 60),
  rut text not null constraint child_requests_rut_valid check (public.rut_is_valid(rut)),
  email text not null check (email ~ '^\S+@\S+\.\S+$' and length(email) <= 200),
  birth_date date not null check (birth_date >= '1900-01-01'),
  address text not null check (length(address) between 1 and 200),
  status public.request_status not null default 'pendiente',
  reject_reason text check (reject_reason is null or length(reject_reason) <= 200),
  student_id uuid references public.students (id) on delete set null,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index child_requests_school_idx on public.child_requests (school_id, status);
create index child_requests_guardian_idx on public.child_requests (guardian_id, created_at desc);
alter table public.child_requests enable row level security;
create policy child_requests_select on public.child_requests for select to authenticated
  using ((guardian_id = auth.uid() and public.mfa_ok()) or public.has_school_role(school_id, array['admin']::public.school_role[]));
revoke all on public.child_requests from anon;
revoke insert, update, delete on public.child_requests from authenticated;
grant select on public.child_requests to authenticated;

create or replace function public.request_child(
  p_school_id uuid, p_first_name text, p_middle_name text, p_first_last_name text, p_second_last_name text,
  p_rut text, p_email text, p_birth_date date, p_address text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  rid uuid;
  r text := upper(regexp_replace(coalesce(p_rut, ''), '[.\s]', '', 'g'));
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_student_user(p_school_id) then raise exception 'not a student of this school'; end if;
  if p_birth_date is null or p_birth_date > (now() at time zone 'America/Santiago')::date then raise exception 'invalid birth date'; end if;
  if (select count(*) from public.child_requests where guardian_id = auth.uid() and status = 'pendiente') >= 5 then
    raise exception 'too many pending requests';
  end if;
  if exists (select 1 from public.students where school_id = p_school_id and public.rut_key(rut) = public.rut_key(r)) then
    raise exception 'rut already a student';
  end if;
  if exists (select 1 from public.child_requests where school_id = p_school_id and status = 'pendiente' and public.rut_key(rut) = public.rut_key(r)) then
    raise exception 'rut already requested';
  end if;
  insert into public.child_requests (school_id, guardian_id, first_name, middle_name, first_last_name, second_last_name, rut, email, birth_date, address)
  values (p_school_id, auth.uid(), btrim(p_first_name), nullif(btrim(p_middle_name), ''), btrim(p_first_last_name), btrim(p_second_last_name),
          r, lower(btrim(p_email)), p_birth_date, btrim(p_address))
  returning id into rid;
  return rid;
end;
$$;

create or replace function public.cancel_child_request(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.child_requests where id = p_id and guardian_id = auth.uid() and status = 'pendiente';
  if not found then raise exception 'request not found'; end if;
end;
$$;

-- The school's CEO or an administrator decides. Approving creates the child's student record and the link.
create or replace function public.decide_child_request(p_id uuid, p_approve boolean, p_reason text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  r public.child_requests;
  sid uuid;
begin
  select * into r from public.child_requests where id = p_id for update;
  if not found then raise exception 'request not found'; end if;
  if not public.has_school_role(r.school_id, array['admin']::public.school_role[]) then raise exception 'not allowed'; end if;
  if r.status <> 'pendiente' then raise exception 'request already decided'; end if;
  if p_approve then
    insert into public.students (school_id, first_name, middle_name, first_last_name, second_last_name, rut, email, birth_date, address)
    values (r.school_id, r.first_name, r.middle_name, r.first_last_name, r.second_last_name, r.rut, r.email, r.birth_date, r.address)
    returning id into sid;
    insert into public.student_guardians (student_id, guardian_id, school_id) values (sid, r.guardian_id, r.school_id);
  end if;
  update public.child_requests
  set status = case when p_approve then 'aprobada'::public.request_status else 'rechazada' end,
      reject_reason = case when p_approve then null else nullif(btrim(left(p_reason, 200)), '') end,
      student_id = sid, decided_by = auth.uid(), decided_at = now()
  where id = r.id;
  perform public.audit(r.school_id, case when p_approve then 'child_approved' else 'child_rejected' end, 'child_request', r.id,
                       jsonb_build_object('guardian', r.guardian_id, 'student', sid));
  return sid;
end;
$$;

-- 3. Acting for a child -------------------------------------------------------------------------------------------
alter table public.attendance add column marked_by uuid;

-- Check-in for oneself or for a child; same rules as before (class started, up to 7 days back, scheduled day).
create or replace function public.check_in_for(p_student_id uuid, p_class_id uuid, p_date date)
returns public.attendance language plpgsql security definer set search_path = ''
as $$
declare
  cls record;
  st record;
  today date := (now() at time zone 'America/Santiago')::date;
  row public.attendance;
begin
  if p_student_id is null or p_student_id not in (select public.my_student_ids()) then raise exception 'not a student of this school'; end if;
  select id, school_id, active into cls from public.classes where id = p_class_id;
  if not found or not cls.active then raise exception 'class not available'; end if;
  select id, school_id into st from public.students where id = p_student_id;
  if st.school_id <> cls.school_id then raise exception 'not a student of this school'; end if;
  if p_date is null or p_date > today or p_date < today - 7 then raise exception 'date out of range'; end if;
  if not exists (select 1 from public.class_schedules where class_id = cls.id and weekday = extract(isodow from p_date))
     and not exists (select 1 from public.class_sessions where class_id = cls.id and date = p_date) then
    raise exception 'class is not scheduled that day';
  end if;
  insert into public.attendance (school_id, class_id, student_id, date, self_marked, marked_by)
  values (cls.school_id, cls.id, st.id, p_date, true, auth.uid())
  on conflict (class_id, student_id, date) do nothing;  -- attendance_window: only once the class has started
  select * into row from public.attendance where class_id = cls.id and student_id = st.id and date = p_date;
  return row;
end;
$$;

-- The old entry points keep working, for the caller's own record only.
create or replace function public.check_in_on(p_class_id uuid, p_date date)
returns public.attendance language plpgsql security definer set search_path = ''
as $$
declare sid uuid;
begin
  select s.id into sid from public.students s join public.classes c on c.school_id = s.school_id
  where c.id = p_class_id and s.user_id = auth.uid() and s.active;
  if sid is null then raise exception 'not a student of this school'; end if;
  return public.check_in_for(sid, p_class_id, p_date);
end;
$$;

create or replace function public.undo_check_in_for(p_student_id uuid, p_class_id uuid, p_date date)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_student_id is null or p_student_id not in (select public.my_student_ids()) then raise exception 'not allowed'; end if;
  delete from public.attendance a
  where a.class_id = p_class_id and a.date = p_date and a.student_id = p_student_id and a.confirmed_at is null and a.self_marked;
end;
$$;

create or replace function public.undo_check_in_on(p_class_id uuid, p_date date)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.attendance a
  where a.class_id = p_class_id and a.date = p_date and a.confirmed_at is null and a.self_marked
    and a.student_id in (select id from public.students where user_id = auth.uid());
end;
$$;

create or replace function public.undo_check_in(p_class_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.undo_check_in_on(p_class_id, (now() at time zone 'America/Santiago')::date);
end;
$$;

create or replace function public.update_my_student(
  p_student_id uuid, p_phone text, p_birth_date date, p_address text, p_emergency_contact text, p_emergency_phone text, p_medical_notes text
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_student_id is null or p_student_id not in (select public.my_student_ids()) then raise exception 'not your student record'; end if;
  update public.students set
    phone = nullif(btrim(p_phone), ''), birth_date = p_birth_date, address = nullif(btrim(p_address), ''),
    emergency_contact = nullif(btrim(p_emergency_contact), ''), emergency_phone = nullif(btrim(p_emergency_phone), ''),
    medical_notes = nullif(btrim(p_medical_notes), '')
  where id = p_student_id and active;
  if not found then raise exception 'not your student record'; end if;
end;
$$;

create or replace function public.save_my_public_profile(
  p_student_id uuid, p_handle text, p_published boolean, p_headline text, p_bio text,
  p_show_belt boolean, p_show_skills boolean, p_show_stats boolean
)
returns public.student_profiles language plpgsql security definer set search_path = ''
as $$
declare
  st public.students;
  h text := lower(btrim(p_handle));
  r public.student_profiles;
begin
  if p_student_id is null or p_student_id not in (select public.my_student_ids()) then raise exception 'not allowed'; end if;
  select * into st from public.students where id = p_student_id;
  if not found or not st.active then raise exception 'not allowed'; end if;
  if exists (select 1 from public.student_profiles where school_id = st.school_id and handle = h and student_id <> st.id) then
    raise exception 'handle taken';
  end if;
  insert into public.student_profiles as sp (student_id, school_id, handle, published, headline, bio, show_belt, show_skills, show_stats)
  values (st.id, st.school_id, h, coalesce(p_published, false), nullif(btrim(p_headline), ''), nullif(btrim(p_bio), ''),
          coalesce(p_show_belt, true), coalesce(p_show_skills, true), coalesce(p_show_stats, true))
  on conflict (student_id) do update set
    handle = excluded.handle, published = excluded.published, headline = excluded.headline, bio = excluded.bio,
    show_belt = excluded.show_belt, show_skills = excluded.show_skills, show_stats = excluded.show_stats, updated_at = now()
  returning * into r;
  return r;
end;
$$;

-- student_progress: the guardian may read the child's progress too.
create or replace function public.student_progress(p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  st record;
  xp integer;
  skills jsonb;
begin
  select id, school_id, user_id into st from public.students where id = p_student_id;
  if not found then return null; end if;
  if not (public.is_school_member(st.school_id) or coalesce(st.user_id = auth.uid(), false) or st.id in (select public.my_ward_ids())) then
    raise exception 'not allowed';
  end if;
  select 10 * count(*) into xp from public.attendance where student_id = st.id and confirmed_at is not null;
  select coalesce(jsonb_agg(jsonb_build_object('tag_id', t.id, 'label', t.label, 'icon', t.icon, 'xp', s.xp) order by s.xp desc, t.label), '[]'::jsonb)
    into skills
    from (
      select x.tag_id, 10 * count(*) as xp
      from (
        select a.id, unnest(coalesce(
                 (select se.skill_ids from public.class_sessions se where se.class_id = a.class_id and se.date = a.date order by se.start_time limit 1),
                 public.class_snapshot_skills(a.class_id))) as tag_id
        from public.attendance a
        where a.student_id = st.id and a.confirmed_at is not null
      ) x
      group by x.tag_id
    ) s join public.tags t on t.id = s.tag_id;
  return jsonb_build_object(
    'xp', xp, 'level', xp / 100 + 1, 'level_xp', xp % 100, 'next_level_xp', 100,
    'attended', xp / 10,
    'pending', (select count(*) from public.attendance where student_id = st.id and confirmed_at is null),
    'skills', skills
  );
end;
$$;

-- 4. Handing the account over to the child ------------------------------------------------------------------------
create table public.student_claims (
  code_hash text primary key,
  student_id uuid not null references public.students (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid
);
create index student_claims_student_idx on public.student_claims (student_id);
alter table public.student_claims enable row level security; -- no policies: only through the functions below
revoke all on public.student_claims from anon, authenticated;

create or replace function public.claim_hash(p_code text)
returns text language sql immutable set search_path = ''
as $$ select encode(sha256(convert_to(upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g')), 'UTF8')), 'hex'); $$;

-- The guardian gets a one-time code (12 characters, 7 days). A new code replaces the previous unused one.
create or replace function public.create_student_claim(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  st public.students;
  raw text;
  code text;
  exp timestamptz := now() + interval '7 days';
begin
  if p_student_id is null or p_student_id not in (select public.my_ward_ids()) then raise exception 'not allowed'; end if;
  select * into st from public.students where id = p_student_id;
  if st.user_id is not null then raise exception 'already has an account'; end if;
  delete from public.student_claims where student_id = st.id and used_at is null;
  -- 48 random bits from gen_random_uuid (strong RNG), shown as XXXX-XXXX-XXXX.
  raw := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  code := substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);
  insert into public.student_claims (code_hash, student_id, school_id, created_by, expires_at)
  values (public.claim_hash(code), st.id, st.school_id, auth.uid(), exp);
  perform public.audit(st.school_id, 'claim_code_created', 'student', st.id, '{}'::jsonb);
  return jsonb_build_object('code', code, 'expires_at', exp,
                            'slug', (select slug from public.schools where id = st.school_id));
end;
$$;

-- Who a valid code belongs to (sign-up page, service role only).
create or replace function public.student_claim_info(p_code text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('student_id', st.id, 'school_id', st.school_id, 'first_name', st.first_name,
                            'full_name', st.full_name, 'slug', s.slug)
  from public.student_claims c join public.students st on st.id = c.student_id join public.schools s on s.id = st.school_id
  where c.code_hash = public.claim_hash(p_code) and c.used_at is null and c.expires_at > now() and st.user_id is null and st.active;
$$;

-- The account guard (only admins link a student to a login) lets through exactly one record: the one being claimed
-- inside claim_student_as (transaction-local marker; clients cannot call set_config through the API).
create or replace function public.guard_student_user()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.user_id is distinct from (case when tg_op = 'UPDATE' then old.user_id end)
     and auth.uid() is not null
     and coalesce(current_setting('mcrm.claiming', true), '') <> new.id::text
     and not public.has_school_role(new.school_id, array['admin']::public.school_role[]) then
    raise exception 'only admins can link a student account';
  end if;
  return new;
end;
$$;

-- Links the record to the new login and ends the guardian link. Attendance, XP, payments stay with the record.
create or replace function public.claim_student_as(p_code text, p_user uuid, p_email text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  c public.student_claims;
  st public.students;
begin
  select * into c from public.student_claims where code_hash = public.claim_hash(p_code) for update;
  if not found or c.used_at is not null or c.expires_at <= now() then raise exception 'invalid code'; end if;
  select * into st from public.students where id = c.student_id for update;
  if st.user_id is not null or not st.active then raise exception 'invalid code'; end if;
  if exists (select 1 from public.students where school_id = st.school_id and user_id = p_user) then raise exception 'already a student'; end if;
  perform set_config('mcrm.claiming', st.id::text, true);
  update public.students set user_id = p_user, email = coalesce(nullif(lower(btrim(p_email)), ''), email) where id = st.id;
  perform set_config('mcrm.claiming', '', true);
  delete from public.student_guardians where student_id = st.id;
  update public.student_claims set used_at = now(), used_by = p_user where code_hash = c.code_hash;
  perform public.audit(st.school_id, 'student_claimed', 'student', st.id, jsonb_build_object('user', p_user, 'guardian', c.created_by));
  return st.id;
end;
$$;

-- Same, for someone who already has a login (enters the code after signing in).
create or replace function public.claim_student(p_code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return public.claim_student_as(p_code, auth.uid(), (select email from auth.users where id = auth.uid()));
end;
$$;

-- 5. Grants -------------------------------------------------------------------------------------------------------
revoke execute on function public.my_ward_ids(), public.request_child(uuid, text, text, text, text, text, text, date, text),
  public.cancel_child_request(uuid), public.decide_child_request(uuid, boolean, text),
  public.check_in_for(uuid, uuid, date), public.undo_check_in_for(uuid, uuid, date),
  public.claim_hash(text), public.create_student_claim(uuid), public.student_claim_info(text),
  public.claim_student_as(text, uuid, text), public.claim_student(text) from public, anon;
-- my_ward_ids appears in RLS policies, so the caller needs EXECUTE (it only returns the caller's own children).
grant execute on function public.my_ward_ids() to authenticated;
grant execute on function public.request_child(uuid, text, text, text, text, text, text, date, text),
  public.cancel_child_request(uuid), public.decide_child_request(uuid, boolean, text),
  public.check_in_for(uuid, uuid, date), public.undo_check_in_for(uuid, uuid, date),
  public.create_student_claim(uuid), public.claim_student(text) to authenticated;
revoke execute on function public.student_claim_info(text), public.claim_student_as(text, uuid, text), public.claim_hash(text) from authenticated;
grant execute on function public.student_claim_info(text), public.claim_student_as(text, uuid, text) to service_role;
