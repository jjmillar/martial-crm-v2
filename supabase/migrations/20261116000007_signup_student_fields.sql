-- Student sign-up from a school's landing asks for the same minimum data as the student form:
-- names, both surnames, RUT, email, birth date (age) and address. They travel with the request and land in the
-- student record when the CEO approves it (filling the blanks of an existing record when it is linked).

alter table public.account_requests
  add column middle_name text check (middle_name is null or length(middle_name) <= 60),
  add column second_last_name text check (second_last_name is null or length(btrim(second_last_name)) between 1 and 60),
  add column birth_date date check (birth_date is null or birth_date between date '1900-01-01' and current_date),
  add column address text check (address is null or length(btrim(address)) between 1 and 200);

drop function if exists public.register_account_request(uuid, uuid, public.request_kind, text, text, text, text, text);

create or replace function public.register_account_request(
  p_school_id uuid, p_user_id uuid, p_kind public.request_kind,
  p_first_name text, p_first_last_name text, p_rut text, p_email text, p_phone text,
  p_middle_name text default null, p_second_last_name text default null, p_birth_date date default null,
  p_address text default null
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
  if p_kind = 'alumno' and (nullif(btrim(p_second_last_name), '') is null or p_birth_date is null or nullif(btrim(p_address), '') is null) then
    raise exception 'missing student data';
  end if;
  insert into public.account_requests (school_id, user_id, kind, first_name, first_last_name, rut, email, phone,
                                       middle_name, second_last_name, birth_date, address)
  values (p_school_id, p_user_id, p_kind, btrim(p_first_name), btrim(p_first_last_name),
          case when k is null then null else left(k, length(k) - 1) || '-' || right(k, 1) end,
          lower(btrim(p_email)), nullif(btrim(p_phone), ''),
          nullif(btrim(p_middle_name), ''), nullif(btrim(p_second_last_name), ''), p_birth_date, nullif(btrim(p_address), ''))
  returning id into req;
  return req;
end;
$$;
revoke execute on function public.register_account_request(uuid, uuid, public.request_kind, text, text, text, text, text, text, text, date, text) from public, anon, authenticated;

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
  if not (public.is_ceo() or public.is_school_owner(r.school_id)) then
    raise exception 'only the CEO can decide requests';
  end if;
  if r.status <> 'pendiente' then raise exception 'request already decided'; end if;

  if p_approve and r.kind = 'alumno' then
    if p_student_id is not null then
      -- link to the existing record, completing only what it is missing
      update public.students s set user_id = r.user_id,
        middle_name = coalesce(s.middle_name, r.middle_name),
        second_last_name = coalesce(s.second_last_name, r.second_last_name),
        birth_date = coalesce(s.birth_date, r.birth_date),
        address = coalesce(s.address, r.address),
        email = coalesce(s.email, r.email),
        phone = coalesce(s.phone, r.phone)
      where s.id = p_student_id and s.school_id = r.school_id and s.user_id is null
      returning s.id into sid;
      if sid is null then raise exception 'student not available'; end if;
    else
      insert into public.students (school_id, first_name, middle_name, first_last_name, second_last_name, rut, email, phone,
                                   birth_date, address, user_id)
      values (r.school_id, r.first_name, r.middle_name, r.first_last_name, r.second_last_name, r.rut, r.email, r.phone,
              r.birth_date, r.address, r.user_id)
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
