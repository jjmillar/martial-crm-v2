// T6 checks: plans isolation, admin-only writes, single default, discipline integrity, money constraints.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), A = await newUser(db, 'ana'), U = await newUser(db, 'uri'), X = await newUser(db, 'xavi')
await db.query(`select public.grant_ceo('ceo@test.cl')`)
const s1 = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const s2 = (await as(db, CEO, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user'), ($4,$5,'admin')`, [s1, A, U, s2, X])
const bjj = (await as(db, A, `insert into public.specialties (school_id, name) values ($1,'BJJ') returning id`, [s1])).rows[0].id
const karate2 = (await as(db, X, `insert into public.specialties (school_id, name) values ($1,'Karate') returning id`, [s2])).rows[0].id

const p1 = await tryAs(db, A, `insert into public.plans (school_id, name, price, specialty_id, is_default) values ($1,'Mensual BJJ',35000,$2,true) returning id`, [s1, bjj])
check('admin creates default plan with discipline', p1.ok, p1.err)
const pU = await tryAs(db, U, `insert into public.plans (school_id, name, price) values ($1,'Hack',1)`, [s1])
check('user role cannot create plans', !pU.ok, pU.err)
check('user role reads plans', (await as(db, U, `select count(*)::int c from public.plans`)).rows[0].c === 1)
const updU = await tryAs(db, U, `update public.plans set price=1`)
check('user role cannot change prices', !updU.ok || updU.affected === 0, updU.err)

const p2 = await tryAs(db, A, `insert into public.plans (school_id, name, price, is_default) values ($1,'Libre',50000,true) returning id`, [s1])
check('second default plan accepted', p2.ok, p2.err)
const defaults = (await db.query(`select name from public.plans where school_id=$1 and is_default`, [s1])).rows.map(r => r.name)
check('marking a new default unmarks the old one', defaults.length === 1 && defaults[0] === 'Libre', defaults)
const p3 = (await as(db, X, `insert into public.plans (school_id, name, price, is_default) values ($1,'Mensual',30000,true) returning id`, [s2])).rows[0].id
check('defaults are per school', (await db.query(`select count(*)::int c from public.plans where is_default`)).rows[0].c === 2)
await as(db, A, `update public.plans set is_default=true where id=$1`, [p1.rows[0].id])
check('re-marking via update keeps one default', (await db.query(`select count(*)::int c from public.plans where school_id=$1 and is_default`, [s1])).rows[0].c === 1)

const inactiveDefault = await tryAs(db, A, `update public.plans set active=false where id=$1`, [p1.rows[0].id])
check('cannot deactivate the default plan', !inactiveDefault.ok, inactiveDefault.err)
const neg = await tryAs(db, A, `insert into public.plans (school_id, name, price) values ($1,'Neg',-1)`, [s1])
check('negative price rejected', !neg.ok, neg.err)
const dup = await tryAs(db, A, `insert into public.plans (school_id, name, price) values ($1,'Libre',1)`, [s1])
check('duplicate plan name rejected', !dup.ok, dup.err)
const trial = await tryAs(db, A, `insert into public.plans (school_id, name, price, billing_cycle, class_count, is_trial) values ($1,'Clase de prueba',0,'unico',1,true)`, [s1])
check('free one-time trial plan accepted', trial.ok, trial.err)
const crossSp = await tryAs(db, A, `insert into public.plans (school_id, name, price, specialty_id) values ($1,'Cruzado',1,$2)`, [s1, karate2])
check('discipline from another school rejected', !crossSp.ok, crossSp.err)

check('other school admin cannot see school 1 plans', (await as(db, X, `select count(*)::int c from public.plans where school_id=$1`, [s1])).rows[0].c === 0)
const xUpd = await tryAs(db, X, `update public.plans set price=1 where id=$1`, [p1.rows[0].id])
check('other school admin cannot edit school 1 plans', !xUpd.ok || xUpd.affected === 0, xUpd.err)
const move = await tryAs(db, CEO, `update public.plans set school_id=$2 where id=$1`, [p3, s1])
check('plan cannot move schools', !move.ok, move.err)

await as(db, A, `delete from public.specialties where id=$1`, [bjj])
const after = (await db.query(`select specialty_id, school_id from public.plans where id=$1`, [p1.rows[0].id])).rows[0]
check('deleting the discipline keeps the plan as "all disciplines"', after && after.specialty_id === null && after.school_id === s1, after)
const del = await tryAs(db, A, `delete from public.plans where name='Clase de prueba'`)
check('admin deletes plan', del.ok && del.affected === 1, del.err)

report()
