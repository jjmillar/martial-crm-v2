// Independent verification of T1/T1b (S2, S3, S5): CEO platform role, school isolation, admin/user roles, last-admin guard.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), A = await newUser(db, 'ana'), B = await newUser(db, 'beto'), U = await newUser(db, 'uri'), X = await newUser(db, 'xavi')

const prof = await db.query(`select full_name from public.profiles where id = $1`, [A])
check('signup trigger creates profile with full_name', prof.rows[0]?.full_name === 'ana', prof.rows)

// CEO designation: only superuser/service role
const selfGrant = await tryAs(db, A, `select public.grant_ceo('ana@test.cl')`)
check('authenticated cannot grant_ceo', !selfGrant.ok, selfGrant.err)
const anonGrant = await tryAs(db, null, `select public.grant_ceo('ana@test.cl')`)
check('anon cannot grant_ceo', !anonGrant.ok, anonGrant.err)
await db.query(`select public.grant_ceo('CEO@test.cl')`)
check('grant_ceo is case-insensitive on email', (await as(db, CEO, `select public.is_ceo() v`)).rows[0].v === true)
const missing = await db.query(`select public.grant_ceo('nobody@test.cl')`).then(() => null, e => e.message)
check('grant_ceo unknown email raises', /user not found/.test(missing ?? ''), missing)
const directPa = await tryAs(db, A, `insert into public.platform_admins (user_id) values ($1)`, [A])
check('cannot self-insert into platform_admins', !directPa.ok, directPa.err)

// Only the CEO creates schools
const notCeo = await tryAs(db, A, `select public.create_school('Dojo A','dojo-a')`)
check('non-CEO cannot create_school', !notCeo.ok && /only the CEO/.test(notCeo.err), notCeo.err)
const anon = await tryAs(db, null, `select public.create_school('X','dojo-x')`)
check('anon cannot create_school', !anon.ok, anon.err)
const s1 = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const s2 = (await as(db, CEO, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
check('CEO is not auto-added as member', (await db.query(`select count(*)::int c from public.school_members where user_id=$1`, [CEO])).rows[0].c === 0)
const badSlug = await tryAs(db, CEO, `select public.create_school('Bad','Bad Slug!')`)
check('invalid slug rejected', !badSlug.ok, badSlug.err)

// CEO assigns admins
const ceoAdd = await tryAs(db, CEO, `insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($3,$4,'admin')`, [s1, A, s2, B])
check('CEO can add admins to any school', ceoAdd.ok, ceoAdd.err)
check('CEO sees all schools', (await as(db, CEO, `select count(*)::int c from public.schools`)).rows[0].c === 2)

// Isolation between schools
const seenA = await as(db, A, `select id from public.schools`)
check('admin A sees only own school', seenA.rows.length === 1 && seenA.rows[0].id === s1, seenA.rows)
check('anon sees no schools', (await tryAs(db, null, `select id from public.schools`)).rows?.length === 0)
await tryAs(db, A, `update public.schools set name='hacked' where id=$1`, [s2])
check('A cannot update school 2', (await db.query(`select name from public.schools where id=$1`, [s2])).rows[0].name === 'Dojo Dos')
const joinB = await tryAs(db, A, `insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin')`, [s2, A])
check('A cannot add self to school 2', !joinB.ok, joinB.err)
check('A cannot read school 2 members', (await as(db, A, `select * from public.school_members where school_id=$1`, [s2])).rows.length === 0)
const directIns = await tryAs(db, CEO, `insert into public.schools (name, slug) values ('direct','direct-x')`)
check('direct insert into schools blocked (even CEO, RPC only)', !directIns.ok, directIns.err)

// Admin powers inside own school
const addUser = await tryAs(db, A, `insert into public.school_members (school_id, user_id, role) values ($1,$2,'user')`, [s1, U])
check('admin adds a user', addUser.ok, addUser.err)
const upd = await tryAs(db, A, `update public.schools set city='Los Angeles' where id=$1`, [s1])
check('admin updates own school', (await db.query(`select city from public.schools where id=$1`, [s1])).rows[0].city === 'Los Angeles', upd)
await tryAs(db, A, `delete from public.schools where id=$1`, [s1])
check('admin cannot delete school (CEO only)', (await db.query(`select count(*)::int c from public.schools where id=$1`, [s1])).rows[0].c === 1)

// User role limits
const userAdds = await tryAs(db, U, `insert into public.school_members (school_id, user_id, role) values ($1,$2,'user')`, [s1, X])
check('user cannot add members', !userAdds.ok, userAdds.err)
await tryAs(db, U, `update public.school_members set role='admin' where school_id=$1 and user_id=$2`, [s1, U])
check('user cannot promote self', (await db.query(`select role from public.school_members where school_id=$1 and user_id=$2`, [s1, U])).rows[0].role === 'user')
await tryAs(db, U, `update public.schools set name='x' where id=$1`, [s1])
check('user cannot edit school', (await db.query(`select name from public.schools where id=$1`, [s1])).rows[0].name === 'Dojo Uno')

// Last-admin guard
const demoteLast = await tryAs(db, A, `update public.school_members set role='user' where school_id=$1 and user_id=$2`, [s1, A])
check('cannot demote last admin', !demoteLast.ok && /at least one admin/.test(demoteLast.err), demoteLast.err)
const removeLast = await tryAs(db, CEO, `delete from public.school_members where school_id=$1 and user_id=$2`, [s1, A])
check('cannot remove last admin (even CEO)', !removeLast.ok && /at least one admin/.test(removeLast.err), removeLast.err)
await as(db, A, `update public.school_members set role='admin' where school_id=$1 and user_id=$2`, [s1, U])
const demoteWithBackup = await tryAs(db, A, `update public.school_members set role='user' where school_id=$1 and user_id=$2`, [s1, A])
check('can demote an admin when another admin remains', demoteWithBackup.ok, demoteWithBackup.err)
const delSchool = await tryAs(db, CEO, `delete from public.schools where id=$1`, [s2])
check('CEO can delete a school (cascade passes the guard)', delSchool.ok && (await db.query(`select count(*)::int c from public.school_members where school_id=$1`, [s2])).rows[0].c === 0, delSchool.err)

// Profiles
check('A cannot read profile of B (no shared school)', (await as(db, A, `select id from public.profiles where id=$1`, [B])).rows.length === 0)
check('A can read profile of U (shared school)', (await as(db, A, `select id from public.profiles where id=$1`, [U])).rows.length === 1)
check('CEO can read any profile', (await as(db, CEO, `select count(*)::int c from public.profiles`)).rows[0].c === 5)
await tryAs(db, A, `update public.profiles set full_name='x' where id=$1`, [U])
check('A cannot edit profile of U', (await db.query(`select full_name from public.profiles where id=$1`, [U])).rows[0].full_name === 'uri')

const rls = await db.query(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`)
check('RLS enabled on every public table', rls.rows.length === 0, rls.rows)
const legacy = await db.query(`select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='school_role' order by enumsortorder`)
check('school_role is exactly admin,user', legacy.rows.map(r => r.enumlabel).join() === 'admin,user', legacy.rows)

report()
