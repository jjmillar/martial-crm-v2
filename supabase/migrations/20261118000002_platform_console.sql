-- "El CRM del CRM": one platform operator account (username, no email) that manages the customers' subscriptions to
-- Martial CRM. It is NOT a school user:
--   * it never reads school data (students, payments, attendance…): only per-customer aggregates through the
--     platform_* functions below (least privilege, OWASP A01);
--   * it always needs two-step verification: every platform_* function requires an aal2 session (A07);
--   * platform_admins (the old "sees every school" CEO) is emptied: the owner's own account stays the CEO of their
--     schools as a regular owner, and no account can read every school any more.
-- Subscriptions are per customer (owner). A suspended or cancelled subscription blocks the customer's schools for
-- everyone (owner, team and students) in the RLS helpers; landing pages stay up.

-- 1. Operator ----------------------------------------------------------------------------------------------------
create table public.platform_operators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{3,31}$'),
  created_at timestamptz not null default now()
);
alter table public.platform_operators enable row level security;
create policy platform_operators_self on public.platform_operators for select to authenticated using (user_id = auth.uid());
revoke all on public.platform_operators from anon;
revoke insert, update, delete on public.platform_operators from authenticated;

-- Operator with a two-step-verified session (aal2). Without it nothing on the platform is reachable.
create or replace function public.is_platform_operator()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.platform_operators where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- For the app shell only: tells the signed-in account whether it is the operator and whether the session is
-- verified yet (so it can ask for the code or for the authenticator setup). Reveals nothing about others.
create or replace function public.platform_whoami()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'operator', exists (select 1 from public.platform_operators where user_id = auth.uid()),
    'username', (select username from public.platform_operators where user_id = auth.uid()),
    'verified', coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  );
$$;

-- The old platform-wide CEO goes away (its account keeps owning its schools through owners/schools.owner_id).
delete from public.platform_admins;

-- 2. Plans and subscriptions -------------------------------------------------------------------------------------
create type public.subscription_status as enum ('prueba', 'activa', 'suspendida', 'cancelada');

create table public.platform_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 60),
  price_clp integer not null default 0 check (price_clp >= 0),
  period text not null default 'mensual' check (period in ('mensual', 'anual')),
  max_schools integer check (max_schools is null or max_schools > 0),
  max_students integer check (max_students is null or max_students > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.platform_plans enable row level security;
create policy platform_plans_operator on public.platform_plans for all to authenticated
  using (public.is_platform_operator()) with check (public.is_platform_operator());
revoke all on public.platform_plans from anon;

create table public.subscriptions (
  owner_id uuid primary key references public.owners (user_id) on delete cascade,
  plan_id uuid references public.platform_plans (id) on delete set null,
  status public.subscription_status not null default 'prueba',
  trial_ends date,
  period_end date,
  notes text check (notes is null or length(notes) <= 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.subscriptions enable row level security;
-- The customer sees their own subscription; only the operator changes it (through platform_update_subscription).
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (owner_id = auth.uid() or public.is_platform_operator());
revoke all on public.subscriptions from anon;
revoke insert, update, delete on public.subscriptions from authenticated;

create table public.subscription_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.owners (user_id) on delete cascade,
  at timestamptz not null default now(),
  actor uuid,
  details jsonb not null default '{}'::jsonb
);
create index subscription_events_owner_idx on public.subscription_events (owner_id, at desc);
alter table public.subscription_events enable row level security;
create policy subscription_events_operator on public.subscription_events for select to authenticated
  using (public.is_platform_operator());
revoke all on public.subscription_events from anon;
revoke insert, update, delete on public.subscription_events from authenticated;

insert into public.platform_plans (name, price_clp, period, max_schools, max_students)
values ('Cortesía', 0, 'mensual', null, null), ('Estándar', 29990, 'mensual', 1, 150);

-- Existing customers: active (the platform owner's own schools ride on "Cortesía").
insert into public.subscriptions (owner_id, plan_id, status)
select o.user_id, (select id from public.platform_plans where name = 'Cortesía'), 'activa' from public.owners o
on conflict do nothing;

-- New customers (main-site sign-up) start a 14-day trial on the cheapest active paid plan.
create or replace function public.subscription_for_new_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.subscriptions (owner_id, plan_id, status, trial_ends)
  values (new.user_id,
          (select id from public.platform_plans where active and price_clp > 0 order by price_clp limit 1),
          'prueba', current_date + 14)
  on conflict do nothing;
  return new;
end;
$$;
create trigger owners_subscription after insert on public.owners
  for each row execute function public.subscription_for_new_owner();
revoke execute on function public.subscription_for_new_owner() from public, anon, authenticated;

-- 3. Blocking: a suspended/cancelled customer's schools are closed for everyone ---------------------------------
create or replace function public.school_blocked(p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.schools s join public.subscriptions sub on sub.owner_id = s.owner_id
    where s.id = p_school_id and sub.status in ('suspendida', 'cancelada')
  );
$$;

create or replace function public.is_school_owner(p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.schools where id = p_school_id and owner_id = auth.uid()) and public.mfa_ok()
       and not public.school_blocked(p_school_id); $$;

create or replace function public.is_school_member(p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_ceo() or public.is_school_owner(p_school_id) or (exists (
    select 1 from public.school_members where school_id = p_school_id and user_id = auth.uid()
  ) and public.mfa_ok() and not public.school_blocked(p_school_id));
$$;

create or replace function public.has_school_role(p_school_id uuid, p_roles public.school_role[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_ceo() or public.is_school_owner(p_school_id) or (exists (
    select 1 from public.school_members where school_id = p_school_id and user_id = auth.uid() and role = any(p_roles)
  ) and public.mfa_ok() and not public.school_blocked(p_school_id));
$$;

create or replace function public.is_student_user(p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.students where school_id = p_school_id and user_id = auth.uid() and active)
       and public.mfa_ok() and not public.school_blocked(p_school_id); $$;

create or replace function public.my_student_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $$ select id from public.students where user_id = auth.uid() and active and public.mfa_ok()
       and not public.school_blocked(school_id); $$;

drop policy students_select_own on public.students;
create policy students_select_own on public.students for select to authenticated
  using (user_id = auth.uid() and not public.school_blocked(school_id));

-- What a blocked account sees instead of empty pages: the names of its schools that are closed.
create or replace function public.my_blocked_schools()
returns table (school_id uuid, name text, status public.subscription_status)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.name, sub.status
  from public.schools s join public.subscriptions sub on sub.owner_id = s.owner_id
  where sub.status in ('suspendida', 'cancelada')
    and (s.owner_id = auth.uid()
         or exists (select 1 from public.school_members m where m.school_id = s.id and m.user_id = auth.uid())
         or exists (select 1 from public.students st where st.school_id = s.id and st.user_id = auth.uid() and st.active));
$$;

-- 4. Operator console --------------------------------------------------------------------------------------------
-- One row per customer: who they are, their schools with student counts, and the subscription. No student data.
create or replace function public.platform_customers()
returns table (
  owner_id uuid, full_name text, email text, created_at timestamptz, last_sign_in_at timestamptz,
  schools jsonb, students integer, plan_id uuid, plan_name text, price_clp integer, period text,
  status public.subscription_status, trial_ends date, period_end date, notes text, updated_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_operator() then raise exception 'not allowed'; end if;
  return query
  select o.user_id, p.full_name, u.email::text, o.created_at, u.last_sign_in_at,
         coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug,
                     'students', (select count(*) from public.students st where st.school_id = s.id and st.active))
                     order by s.name)
                   from public.schools s where s.owner_id = o.user_id), '[]'::jsonb),
         (select count(*)::int from public.students st join public.schools s on s.id = st.school_id
          where s.owner_id = o.user_id and st.active),
         sub.plan_id, pl.name, pl.price_clp, pl.period, sub.status, sub.trial_ends, sub.period_end, sub.notes, sub.updated_at
  from public.owners o
  join auth.users u on u.id = o.user_id
  left join public.profiles p on p.id = o.user_id
  left join public.subscriptions sub on sub.owner_id = o.user_id
  left join public.platform_plans pl on pl.id = sub.plan_id
  order by o.created_at desc;
end;
$$;

create or replace function public.platform_update_subscription(
  p_owner uuid, p_plan uuid, p_status public.subscription_status, p_trial_ends date, p_period_end date, p_notes text
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  old public.subscriptions;
  changes jsonb := '{}'::jsonb;
begin
  if not public.is_platform_operator() then raise exception 'not allowed'; end if;
  if p_plan is not null and not exists (select 1 from public.platform_plans where id = p_plan) then raise exception 'plan not found'; end if;
  if p_notes is not null and length(p_notes) > 1000 then raise exception 'notes too long'; end if;
  insert into public.subscriptions (owner_id) values (p_owner) on conflict do nothing;
  select * into old from public.subscriptions where owner_id = p_owner for update;
  if not found then raise exception 'customer not found'; end if;

  if old.plan_id is distinct from p_plan then
    changes := changes || jsonb_build_object('plan', jsonb_build_array(
      (select name from public.platform_plans where id = old.plan_id), (select name from public.platform_plans where id = p_plan)));
  end if;
  if old.status is distinct from p_status then changes := changes || jsonb_build_object('status', jsonb_build_array(old.status, p_status)); end if;
  if old.trial_ends is distinct from p_trial_ends then changes := changes || jsonb_build_object('trial_ends', jsonb_build_array(old.trial_ends, p_trial_ends)); end if;
  if old.period_end is distinct from p_period_end then changes := changes || jsonb_build_object('period_end', jsonb_build_array(old.period_end, p_period_end)); end if;
  if old.notes is distinct from nullif(btrim(p_notes), '') then changes := changes || jsonb_build_object('notes', true); end if;
  if changes = '{}'::jsonb then return; end if;

  update public.subscriptions
  set plan_id = p_plan, status = p_status, trial_ends = p_trial_ends, period_end = p_period_end,
      notes = nullif(btrim(p_notes), ''), updated_at = now(), updated_by = auth.uid()
  where owner_id = p_owner;
  insert into public.subscription_events (owner_id, actor, details) values (p_owner, auth.uid(), changes);
end;
$$;

-- Latest changes across every customer (history at the end of the console).
create or replace function public.platform_events(p_limit integer default 50)
returns table (id bigint, at timestamptz, owner_id uuid, customer text, details jsonb)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_operator() then raise exception 'not allowed'; end if;
  return query
  select e.id, e.at, e.owner_id, coalesce(nullif(p.full_name, ''), u.email::text), e.details
  from public.subscription_events e
  left join public.profiles p on p.id = e.owner_id
  left join auth.users u on u.id = e.owner_id
  order by e.at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 500);
end;
$$;

-- 5. Grants (default privileges no longer give EXECUTE to anyone) ------------------------------------------------
revoke execute on function public.is_platform_operator(), public.platform_whoami(), public.school_blocked(uuid),
  public.my_blocked_schools(), public.platform_customers(),
  public.platform_update_subscription(uuid, uuid, public.subscription_status, date, date, text),
  public.platform_events(integer) from public, anon;
grant execute on function public.is_platform_operator(), public.platform_whoami(), public.my_blocked_schools(),
  public.platform_customers(), public.platform_update_subscription(uuid, uuid, public.subscription_status, date, date, text),
  public.platform_events(integer) to authenticated;
-- school_blocked is internal (used by the RLS helpers, which are security definer).
grant select on public.platform_operators, public.platform_plans, public.subscriptions, public.subscription_events to authenticated;
grant insert, update, delete on public.platform_plans to authenticated;
