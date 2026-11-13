-- SaaS: anyone can sign up on the main site as a CEO (school owner / customer).
-- Two levels from now on:
--   * platform admin (platform_admins, is_ceo()): the platform owner, sees every school.
--   * owner (owners, schools.owner_id): a customer CEO, full access ONLY to the schools they own.
-- is_school_member / has_school_role now also grant access to the school's owner, so every existing policy
-- keeps working per tenant without being rewritten.

create table public.owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.owners enable row level security;
create policy owners_select_own on public.owners for select to authenticated using (user_id = auth.uid());

alter table public.schools add column owner_id uuid references auth.users (id) on delete set null;
create index schools_owner_idx on public.schools (owner_id);

-- Existing schools belong to the platform owner, who is also an owner.
insert into public.owners (user_id) select user_id from public.platform_admins on conflict do nothing;
update public.schools set owner_id = (select user_id from public.platform_admins order by created_at limit 1) where owner_id is null;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.owners where user_id = auth.uid()); $$;

create or replace function public.is_school_owner(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.schools where id = p_school_id and owner_id = auth.uid()); $$;

create or replace function public.is_school_member(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_ceo() or public.is_school_owner(p_school_id) or exists (
    select 1 from public.school_members where school_id = p_school_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_school_role(p_school_id uuid, p_roles public.school_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_ceo() or public.is_school_owner(p_school_id) or exists (
    select 1 from public.school_members where school_id = p_school_id and user_id = auth.uid() and role = any(p_roles)
  );
$$;

grant execute on function public.is_owner(), public.is_school_owner(uuid) to authenticated;

-- Owners (and the platform admin) create schools; the creator owns it.
create or replace function public.create_school(p_name text, p_slug text)
returns public.schools
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school public.schools%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not (public.is_ceo() or public.is_owner()) then raise exception 'only the CEO can create schools'; end if;
  insert into public.schools (name, slug, owner_id) values (p_name, p_slug, auth.uid()) returning * into v_school;
  return v_school;
end;
$$;

drop policy "schools_delete_policy" on public.schools;
create policy "schools_delete_policy" on public.schools for delete using (public.is_ceo() or owner_id = auth.uid());

-- Owners see the profiles of their schools' members (members already see each other).
create policy profiles_select_owner on public.profiles for select to authenticated using (
  exists (select 1 from public.school_members sm join public.schools s on s.id = sm.school_id
          where s.owner_id = auth.uid() and sm.user_id = profiles.id)
);

-- Members list shows the school's owner (CEO) on top, not the platform admin.
drop function if exists public.platform_ceos();
create or replace function public.school_owner(p_school_id uuid)
returns table (user_id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.email
  from public.schools s join public.profiles p on p.id = s.owner_id
  where s.id = p_school_id and public.is_school_member(p_school_id);
$$;
revoke execute on function public.school_owner(uuid) from public, anon;
grant execute on function public.school_owner(uuid) to authenticated;

-- Account requests now come from each school's own landing page: the school's owner decides them.
drop function if exists public.public_schools();
drop policy account_requests_select on public.account_requests;
create policy account_requests_select on public.account_requests for select to authenticated
  using (user_id = auth.uid() or public.is_ceo() or public.is_school_owner(school_id));

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

-- Called by the Edge Function account-signup (service role) for a new CEO account.
create or replace function public.register_owner(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then raise exception 'not allowed'; end if; -- service role only
  insert into public.owners (user_id) values (p_user_id) on conflict do nothing;
end;
$$;
revoke execute on function public.register_owner(uuid) from public, anon, authenticated;
