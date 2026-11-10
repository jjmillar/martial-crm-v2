-- Migration: Foundation schema for Martial CRM v2
-- Includes enum school_role, tables schools, profiles, school_members, triggers, helper functions, create_school RPC, and RLS policies.

-- 1. Create school_role enum
create type public.school_role as enum ('owner', 'admin', 'instructor', 'student');

-- 2. Create schools table
create table public.schools (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text unique not null check (slug ~ '^[a-z0-9-]{3,48}$'),
    logo_url text,
    address text,
    city text,
    phone text,
    email text,
    description text,
    default_calendar_view text not null default 'week' check (default_calendar_view in ('day', 'week', 'month')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 3. Create profiles table
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    avatar_url text,
    phone text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 4. Create school_members table
create table public.school_members (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role public.school_role not null default 'student',
    created_at timestamptz not null default now(),
    constraint school_members_school_id_user_id_key unique (school_id, user_id)
);

-- Indexes for school_members
create index idx_school_members_user_id on public.school_members(user_id);
create index idx_school_members_school_id on public.school_members(school_id);

-- 5. Updated_at trigger function and triggers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_schools_updated_at
    before update on public.schools
    for each row
    execute function public.set_updated_at();

create trigger set_profiles_updated_at
    before update on public.profiles
    for each row
    execute function public.set_updated_at();

-- 6. Automatic profile creation on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, full_name)
    values (new.id, new.raw_user_meta_data->>'full_name');
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- 7. Helper security definer functions for membership and role checks
create or replace function public.is_school_member(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.school_members
        where school_id = p_school_id
          and user_id = auth.uid()
    );
$$;

create or replace function public.has_school_role(p_school_id uuid, p_roles public.school_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.school_members
        where school_id = p_school_id
          and user_id = auth.uid()
          and role = any(p_roles)
    );
$$;

-- 8. create_school RPC function
create or replace function public.create_school(p_name text, p_slug text)
returns public.schools
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_school public.schools%rowtype;
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;

    insert into public.schools (name, slug)
    values (p_name, p_slug)
    returning * into v_school;

    insert into public.school_members (school_id, user_id, role)
    values (v_school.id, auth.uid(), 'owner');

    return v_school;
end;
$$;

revoke execute on function public.create_school(text, text) from public;
revoke execute on function public.create_school(text, text) from anon;
grant execute on function public.create_school(text, text) to authenticated;

-- 9. Enable Row Level Security on all foundation tables
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.school_members enable row level security;

-- 10. RLS Policies for schools
create policy "schools_select_policy" on public.schools
    for select
    using (public.is_school_member(id));

create policy "schools_update_policy" on public.schools
    for update
    using (public.has_school_role(id, array['owner', 'admin']::public.school_role[]))
    with check (public.has_school_role(id, array['owner', 'admin']::public.school_role[]));

create policy "schools_delete_policy" on public.schools
    for delete
    using (public.has_school_role(id, array['owner']::public.school_role[]));

-- 11. RLS Policies for profiles
create policy "profiles_select_policy" on public.profiles
    for select
    using (
        id = auth.uid()
        or exists (
            select 1
            from public.school_members sm1
            join public.school_members sm2 on sm1.school_id = sm2.school_id
            where sm1.user_id = auth.uid()
              and sm2.user_id = profiles.id
        )
    );

create policy "profiles_update_policy" on public.profiles
    for update
    using (id = auth.uid())
    with check (id = auth.uid());

-- 12. RLS Policies for school_members
create policy "school_members_select_policy" on public.school_members
    for select
    using (public.is_school_member(school_id));

create policy "school_members_insert_policy" on public.school_members
    for insert
    with check (
        public.has_school_role(school_id, array['owner', 'admin']::public.school_role[])
        and (role <> 'owner' or public.has_school_role(school_id, array['owner']::public.school_role[]))
    );

create policy "school_members_update_policy" on public.school_members
    for update
    using (
        public.has_school_role(school_id, array['owner', 'admin']::public.school_role[])
        and (role <> 'owner' or public.has_school_role(school_id, array['owner']::public.school_role[]))
    )
    with check (
        public.has_school_role(school_id, array['owner', 'admin']::public.school_role[])
        and (role <> 'owner' or public.has_school_role(school_id, array['owner']::public.school_role[]))
    );

create policy "school_members_delete_policy" on public.school_members
    for delete
    using (
        public.has_school_role(school_id, array['owner', 'admin']::public.school_role[])
        and (role <> 'owner' or public.has_school_role(school_id, array['owner']::public.school_role[]))
    );
