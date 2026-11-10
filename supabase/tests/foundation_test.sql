-- pgTAP tests for foundation schema, RLS, and RPC functions

begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Create test auth users A and B
insert into auth.users (id, email, raw_user_meta_data)
values 
    ('11111111-1111-1111-1111-111111111111', 'user-a@crm.test', '{"full_name": "User A"}'::jsonb),
    ('22222222-2222-2222-2222-222222222222', 'user-b@crm.test', '{"full_name": "User B"}'::jsonb);

-- 1. Verify profile trigger created profile for user A
select ok(
    exists (select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111' and full_name = 'User A'),
    'Profile row exists for A after insert into auth.users'
);

-- 2. Verify anon role cannot execute create_school
-- anon has no EXECUTE grant on create_school (42501 = insufficient_privilege)
set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
    $$select public.create_school('Anon Dojo', 'anon-dojo')$$,
    '42501',
    null,
    'Anon role cannot execute create_school'
);

-- 3. Authenticate as User A and create school
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

select lives_ok(
    $$select public.create_school('Dojo A', 'dojo-a')$$,
    'User A successfully creates school Dojo A'
);

-- 4. Authenticate as User B and create school
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);

select lives_ok(
    $$select public.create_school('Dojo B', 'dojo-b')$$,
    'User B successfully creates school Dojo B'
);

-- Switch back to User A
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

-- 5. Assert A sees exactly 1 school (their own)
select is(
    (select count(*)::int from public.schools),
    1,
    'A sees exactly 1 school'
);

-- 6. Assert A cannot see school B
select ok(
    not exists (select 1 from public.schools where slug = 'dojo-b'),
    'A cannot see school B'
);

-- 7. Assert A cannot update school B (0 rows affected)
-- RLS makes school B invisible to A, so the update matches 0 rows
update public.schools set name = 'Hacked A' where slug = 'dojo-b';
reset role;
select is(
    (select name from public.schools where slug = 'dojo-b'),
    'Dojo B',
    'A cannot update school B'
);
-- remember B's id as superuser, since A cannot see it under RLS
select set_config('test.school_b', (select id::text from public.schools where slug = 'dojo-b'), true);
set local role authenticated;

-- 8. Assert A cannot insert a school_members row into school B
select throws_ok(
    format(
        'insert into public.school_members (school_id, user_id, role) values (%L, %L, %L)',
        current_setting('test.school_b'),
        '11111111-1111-1111-1111-111111111111',
        'instructor'
    ),
    'new row violates row-level security policy for table "school_members"',
    'A cannot insert a school_members row into school B'
);

select * from finish();
rollback;
