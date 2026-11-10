// Independent verification of T1 (S2, S3, S5): isolation between schools, roles, RPC, signup trigger.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const A = await newUser(db, 'ana'), B = await newUser(db, 'beto'), C = await newUser(db, 'caro')

const prof = await db.query(`select full_name from public.profiles where id = $1`, [A])
check('signup trigger creates profile with full_name', prof.rows[0]?.full_name === 'ana', prof.rows)

const sa = (await as(db, A, `select (public.create_school('Dojo A','dojo-a')).id`)).rows[0].id
const sb = (await as(db, B, `select (public.create_school('Dojo B','dojo-b')).id`)).rows[0].id
check('creator becomes owner', (await db.query(`select role from public.school_members where school_id=$1 and user_id=$2`, [sa, A])).rows[0]?.role === 'owner')

const anon = await tryAs(db, null, `select public.create_school('X','dojo-x')`)
check('anon cannot create_school', !anon.ok, anon.err)
const badSlug = await tryAs(db, A, `select public.create_school('Bad','Bad Slug!')`)
check('invalid slug rejected', !badSlug.ok, badSlug.err)
const dupSlug = await tryAs(db, C, `select public.create_school('Dup','dojo-a')`)
check('duplicate slug rejected', !dupSlug.ok, dupSlug.err)

const seenA = await as(db, A, `select id from public.schools`)
check('A sees only own school', seenA.rows.length === 1 && seenA.rows[0].id === sa, seenA.rows)
const anonSee = await tryAs(db, null, `select id from public.schools`)
check('anon sees no schools', anonSee.ok ? anonSee.rows.length === 0 : true, anonSee)

const upd = await tryAs(db, A, `update public.schools set name='hacked' where id=$1`, [sb])
check('A cannot update school B', (await db.query(`select name from public.schools where id=$1`, [sb])).rows[0].name === 'Dojo B', upd)
const directIns = await tryAs(db, A, `insert into public.schools (name, slug) values ('direct','direct-x')`)
check('direct insert into schools blocked', !directIns.ok, directIns.err)

const joinB = await tryAs(db, A, `insert into public.school_members (school_id, user_id, role) values ($1,$2,'owner')`, [sb, A])
check('A cannot add self to school B', !joinB.ok, joinB.err)
const membersB = await as(db, A, `select * from public.school_members where school_id=$1`, [sb])
check('A cannot read school B members', membersB.rows.length === 0)

// admin vs owner rules inside school A
await as(db, A, `insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin')`, [sa, C])
const adminMakesOwner = await tryAs(db, C, `insert into public.school_members (school_id, user_id, role) values ($1,$2,'owner')`, [sa, B])
check('admin cannot create an owner', !adminMakesOwner.ok, adminMakesOwner.err)
const adminDemotesOwner = await tryAs(db, C, `update public.school_members set role='student' where school_id=$1 and user_id=$2`, [sa, A])
check('admin cannot demote the owner', (await db.query(`select role from public.school_members where school_id=$1 and user_id=$2`, [sa, A])).rows[0].role === 'owner', adminDemotesOwner)
const adminPromotesSelf = await tryAs(db, C, `update public.school_members set role='owner' where school_id=$1 and user_id=$2`, [sa, C])
check('admin cannot promote self to owner', (await db.query(`select role from public.school_members where school_id=$1 and user_id=$2`, [sa, C])).rows[0].role === 'admin', adminPromotesSelf)
const adminDeletesOwner = await tryAs(db, C, `delete from public.school_members where school_id=$1 and user_id=$2`, [sa, A])
check('admin cannot remove the owner', (await db.query(`select count(*)::int c from public.school_members where school_id=$1 and user_id=$2`, [sa, A])).rows[0].c === 1, adminDeletesOwner)
const adminDeletesSchool = await tryAs(db, C, `delete from public.schools where id=$1`, [sa])
check('admin cannot delete school', (await db.query(`select count(*)::int c from public.schools where id=$1`, [sa])).rows[0].c === 1, adminDeletesSchool)

// profiles
const profB = await as(db, A, `select id from public.profiles where id=$1`, [B])
check('A cannot read profile of B (no shared school)', profB.rows.length === 0)
const profC = await as(db, A, `select id from public.profiles where id=$1`, [C])
check('A can read profile of C (shared school)', profC.rows.length === 1)
await tryAs(db, A, `update public.profiles set full_name='x' where id=$1`, [C])
check('A cannot edit profile of C', (await db.query(`select full_name from public.profiles where id=$1`, [C])).rows[0].full_name === 'caro')
const own = await tryAs(db, A, `update public.profiles set full_name='Ana M' where id=$1`, [A])
check('A can edit own profile', (await db.query(`select full_name from public.profiles where id=$1`, [A])).rows[0].full_name === 'Ana M', own)

const rls = await db.query(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`)
check('RLS enabled on every public table', rls.rows.length === 0, rls.rows)

report()
