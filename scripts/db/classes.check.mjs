// T8 checks: classes, tags and schedule blocks: isolation, admin-only writes, same-school links, time rules,
// teacher double-booking, teacher propagation, set_class_details.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), A = await newUser(db, 'ana'), U = await newUser(db, 'uri'), X = await newUser(db, 'xavi')
await db.query(`select public.grant_ceo('ceo@test.cl')`)
const s1 = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const s2 = (await as(db, CEO, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user'), ($4,$5,'admin')`, [s1, A, U, s2, X])
const one = async (who, sql, params) => (await as(db, who, sql, params)).rows[0].id
const t1 = await one(A, `insert into public.teachers (school_id, first_name, first_last_name) values ($1,'Rickson','Gracie') returning id`, [s1])
const t1b = await one(A, `insert into public.teachers (school_id, first_name, first_last_name) values ($1,'Royce','Gracie') returning id`, [s1])
const t2 = await one(X, `insert into public.teachers (school_id, first_name, first_last_name) values ($1,'Otro','Prof') returning id`, [s2])
const tag1 = await one(A, `insert into public.tags (school_id, label) values ($1,'Niños') returning id`, [s1])
const tag2 = await one(X, `insert into public.tags (school_id, label) values ($1,'Kids') returning id`, [s2])

const c1 = await tryAs(db, A, `insert into public.classes (school_id, name, teacher_id, level) values ($1,'BJJ Fundamentos',$2,'principiante') returning id`, [s1, t1])
check('admin creates class with teacher', c1.ok, c1.err)
const cid = c1.rows?.[0]?.id
check('user role cannot create classes', !(await tryAs(db, U, `insert into public.classes (school_id, name) values ($1,'X')`, [s1])).ok)
check('user role reads classes', (await as(db, U, `select count(*)::int c from public.classes`)).rows[0].c === 1)
check('teacher from another school rejected', !(await tryAs(db, A, `insert into public.classes (school_id, name, teacher_id) values ($1,'X',$2)`, [s1, t2])).ok)
check('bad colour rejected', !(await tryAs(db, A, `insert into public.classes (school_id, name, color) values ($1,'X','red')`, [s1])).ok)

const det = await tryAs(db, A, `select public.set_class_details($1, array[$2]::uuid[], '[{"weekday":1,"start_time":"19:00","end_time":"20:30"},{"weekday":3,"start_time":"19:00","end_time":"20:30"}]'::jsonb)`, [cid, tag1])
check('admin sets tags + schedule in one call', det.ok, det.err)
check('two blocks stored with teacher denormalised', (await db.query(`select count(*)::int c from public.class_schedules where class_id=$1 and teacher_id=$2`, [cid, t1])).rows[0].c === 2)
check('cross-school tag rejected', !(await tryAs(db, A, `select public.set_class_details($1, array[$2]::uuid[], '[]'::jsonb)`, [cid, tag2])).ok)
check('end before start rejected', !(await tryAs(db, A, `select public.set_class_details($1, '{}', '[{"weekday":2,"start_time":"20:00","end_time":"19:00"}]'::jsonb)`, [cid])).ok)
check('failed call kept previous schedule (transaction)', (await db.query(`select count(*)::int c from public.class_schedules where class_id=$1`, [cid])).rows[0].c === 2)
check('user role cannot set details', !(await tryAs(db, U, `select public.set_class_details($1, '{}', '[]'::jsonb)`, [cid])).ok)

const c2 = await one(A, `insert into public.classes (school_id, name, teacher_id) values ($1,'BJJ Avanzado',$2) returning id`, [s1, t1])
const clash = await tryAs(db, A, `select public.set_class_details($1, '{}', '[{"weekday":1,"start_time":"20:00","end_time":"21:00"}]'::jsonb)`, [c2])
check('same teacher overlapping block rejected', !clash.ok && /overlap/.test(clash.err), clash.err)
const adjacent = await tryAs(db, A, `select public.set_class_details($1, '{}', '[{"weekday":1,"start_time":"20:30","end_time":"21:30"}]'::jsonb)`, [c2])
check('back-to-back block allowed', adjacent.ok, adjacent.err)
const c3 = await one(A, `insert into public.classes (school_id, name, teacher_id) values ($1,'Muay Thai',$2) returning id`, [s1, t1b])
check('other teacher can use the same slot', (await tryAs(db, A, `select public.set_class_details($1, '{}', '[{"weekday":1,"start_time":"19:00","end_time":"20:30"}]'::jsonb)`, [c3])).ok)
const swap = await tryAs(db, A, `update public.classes set teacher_id=$2 where id=$1`, [c3, t1])
check('reassigning a teacher into a clash is rejected', !swap.ok, swap.err)
await as(db, A, `update public.classes set teacher_id=null where id=$1`, [c2])
check('teacher change propagates to blocks', (await db.query(`select count(*)::int c from public.class_schedules where class_id=$1 and teacher_id is null`, [c2])).rows[0].c === 1)

check('other school admin sees no classes of school 1', (await as(db, X, `select count(*)::int c from public.classes where school_id=$1`, [s1])).rows[0].c === 0)
check('other school admin sees no schedules of school 1', (await as(db, X, `select count(*)::int c from public.class_schedules where school_id=$1`, [s1])).rows[0].c === 0)
check('other school admin cannot set details', !(await tryAs(db, X, `select public.set_class_details($1, '{}', '[]'::jsonb)`, [cid])).ok)
await as(db, A, `delete from public.teachers where id=$1`, [t1])
check('deleting the teacher keeps the class without teacher', (await db.query(`select teacher_id from public.classes where id=$1`, [cid])).rows[0].teacher_id === null)
await as(db, A, `delete from public.classes where id=$1`, [cid])
check('deleting a class removes its blocks and tags', (await db.query(`select (select count(*) from public.class_schedules where class_id=$1)::int + (select count(*) from public.class_tags where class_id=$1)::int c`, [cid])).rows[0].c === 0)

report()
