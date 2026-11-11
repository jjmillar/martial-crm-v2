-- pgTAP tests for foundation schema, platform_admins, RLS, last-admin guard, and RPC functions

begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Create test auth users CEO, A, B
insert into auth.users (id, email, raw_user_meta_data)
values 
    ('00000000-0000-0000-0000-000000000000', 'ceo@crm.test', '{"full_name": "CEO User"}'::jsonb),
    ('11111111-1111-1111-1111-111111111111', 'user-a@crm.test', '{"full_name": "User A"}'::jsonb),
    ('22222222-2222-2222-2222-222222222222', 'user-b@crm.test', '{"full_name": "User B"}'::jsonb);

-- 1. Grant CEO to ceo@crm.test as postgres (superuser)
select lives_ok(
    $$select public.grant_ceo('ceo@crm.test')$$,
    'Grant CEO succeeds for postgres'
);

-- 2. Authenticated non-CEO (User A) cannot execute grant_ceo (42501)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

select throws_ok(
    $$select public.grant_ceo('user-b@crm.test')$$,
    '42501',
    null,
    'Authenticated non-CEO cannot execute grant_ceo'
);

-- 3. Non-CEO A cannot create_school (throws 'only the CEO can create schools')
select throws_ok(
    $$select public.create_school('Dojo A', 'dojo-a')$$,
    'only the CEO can create schools',
    'Non-CEO A cannot create_school'
);

-- 4. Authenticate as CEO, create two schools and insert admin memberships
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000000', 'role', 'authenticated')::text, true);

-- schools can only be created through the RPC (no insert policy on schools)
select lives_ok(
    $$select public.create_school('School 1', 'school-1'); select public.create_school('School 2', 'school-2')$$,
    'CEO creates two schools through create_school'
);

-- CEO assigns admins (has_school_role is true for the CEO in every school)
select lives_ok(
    $$insert into public.school_members (school_id, user_id, role)
      select id, case slug when 'school-1' then '11111111-1111-1111-1111-111111111111'::uuid
                           else '22222222-2222-2222-2222-222222222222'::uuid end, 'admin'
      from public.schools where slug in ('school-1', 'school-2')$$,
    'CEO assigns admin A to school 1 and admin B to school 2'
);

-- 5. CEO sees 2 schools
select is(
    (select count(*)::int from public.schools),
    2,
    'CEO sees 2 schools'
);

-- 6. Authenticate as A: A sees 1 school
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

select is(
    (select count(*)::int from public.schools),
    1,
    'A sees exactly 1 school'
);

-- 7. A cannot see school 2
select ok(
    not exists (select 1 from public.schools where slug = 'school-2'),
    'A cannot see school 2'
);

-- 8. A cannot delete the only admin row of school 1 (throws 'a school must keep at least one admin')
select set_config('test.member_a', (select id::text from public.school_members where school_id = (select id from public.schools where slug = 'school-1') and user_id = '11111111-1111-1111-1111-111111111111'), true);

select throws_ok(
    format(
        'delete from public.school_members where id = %L',
        current_setting('test.member_a')
    ),
    'a school must keep at least one admin',
    'A cannot delete the only admin row of school 1'
);

select * from finish();
rollback;
