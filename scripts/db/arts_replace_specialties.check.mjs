// The school's martial arts replace "especialidades" (migration 20261126000002): data carried over from the old
// specialties, teacher_arts / set_teacher_arts permissions and isolation, classes/plans art FK, landing discipline.
import { boot, migrate, newUser, as, tryAs, check, report } from './harness.mjs'

const MIG = '20261126000002_arts_replace_specialties.sql'
const db = await boot(process.cwd(), { before: MIG })
const OWNER = await newUser(db, 'owner'), ADM = await newUser(db, 'adm'), USR = await newUser(db, 'usr'), OWNER2 = await newUser(db, 'owner2')
await db.query(`insert into public.owners (user_id) values ($1), ($2)`, [OWNER, OWNER2])
const sc = (await as(db, OWNER, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const sc2 = (await as(db, OWNER2, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user')`, [sc, ADM, USR])
const one = async (sql, p) => (await db.query(sql, p)).rows[0]

// ---- Before: old specialties in use --------------------------------------------------------------------------------
const bjjArt = (await as(db, OWNER, `select public.add_school_art($1,'bjj') id`, [sc])).rows[0].id
const judoArt = (await as(db, OWNER, `select public.add_school_art($1,'judo') id`, [sc])).rows[0].id
const sp = async (s, name, active = true) => (await one(`insert into public.specialties (school_id, name, active) values ($1,$2,$3) returning id`, [s, name, active])).id
const spBjj = await sp(sc, 'BJJ'), spJudo = await sp(sc, 'judo'), spMma = await sp(sc, 'MMA'), spOld = await sp(sc, 'Kick boxing', false), spUnused = await sp(sc, 'Yoga')
const spOther = await sp(sc2, 'Karate')
const teacher = async (s, n) => (await one(`insert into public.teachers (school_id, first_name, first_last_name) values ($1,$2,'X') returning id`, [s, n])).id
const t1 = await teacher(sc, 'Uno'), t2 = await teacher(sc, 'Dos'), t3 = await teacher(sc2, 'Tres')
await db.query(`insert into public.teacher_specialties (teacher_id, specialty_id, school_id) values ($1,$2,$5), ($1,$3,$5), ($4,$6,$5)`, [t1, spBjj, spMma, t2, sc, spOld])
await db.query(`insert into public.teacher_specialties (teacher_id, specialty_id, school_id) values ($1,$2,$3)`, [t3, spOther, sc2])
const cBjj = (await one(`insert into public.classes (school_id, name, specialty_id) values ($1,'Fundamentos',$2) returning id`, [sc, spBjj])).id
const cMma = (await one(`insert into public.classes (school_id, name, specialty_id) values ($1,'MMA pro',$2) returning id`, [sc, spMma])).id
const cNone = (await one(`insert into public.classes (school_id, name) values ($1,'Open mat') returning id`, [sc])).id
const pJudo = (await one(`insert into public.plans (school_id, name, price, specialty_id) values ($1,'Judo mensual',30000,$2) returning id`, [sc, spJudo])).id
await db.query(`insert into public.class_schedules (school_id, class_id, weekday, start_time, end_time) values ($1,$2,1,'19:00','20:00')`, [sc, cBjj])
await db.query(`update public.schools set landing_enabled = true, landing_show_schedule = true where id = $1`, [sc])

// ---- Migration -----------------------------------------------------------------------------------------------------
let migErr = null
try { await migrate(db, process.cwd(), MIG) } catch (e) { migErr = e.message }
check('migration applies on existing data', !migErr, migErr)

const arts = (await db.query(`select name, active, template_key from public.school_arts where school_id = $1 order by position`, [sc])).rows
const names = arts.map((a) => a.name)
check('BJJ specialty did not duplicate the BJJ art', names.filter((n) => /jiu|bjj/i.test(n)).length === 1, names)
check('lower-case "judo" matched the Judo art', names.filter((n) => /judo/i.test(n)).length === 1, names)
check('MMA (in use, no art) became an art', arts.some((a) => a.name === 'MMA' && a.active && a.template_key === null), arts)
check('inactive specialty in use became an inactive art', arts.some((a) => a.name === 'Kick boxing' && !a.active), arts)
check('unused specialty did not become an art', !names.includes('Yoga'), names)
const mmaArt = (await one(`select id from public.school_arts where school_id=$1 and name='MMA'`, [sc])).id
const kbArt = (await one(`select id from public.school_arts where school_id=$1 and name='Kick boxing'`, [sc])).id
check("other school's specialty became its own art", (await db.query(`select 1 from public.school_arts where school_id=$1 and name='Karate'`, [sc2])).rows.length === 1)

check('class BJJ points to the BJJ art', (await one(`select art_id from public.classes where id=$1`, [cBjj])).art_id === bjjArt)
check('class MMA points to the new MMA art', (await one(`select art_id from public.classes where id=$1`, [cMma])).art_id === mmaArt)
check('class without specialty stays without art', (await one(`select art_id from public.classes where id=$1`, [cNone])).art_id === null)
check('plan Judo points to the Judo art', (await one(`select art_id from public.plans where id=$1`, [pJudo])).art_id === judoArt)
const ta = (await db.query(`select teacher_id, art_id from public.teacher_arts where school_id=$1`, [sc])).rows
check('teacher arts carried over', ta.length === 3 && ta.some((r) => r.teacher_id === t1 && r.art_id === bjjArt) && ta.some((r) => r.teacher_id === t1 && r.art_id === mmaArt) && ta.some((r) => r.teacher_id === t2 && r.art_id === kbArt), ta)
check("other school's teacher keeps its art", (await db.query(`select 1 from public.teacher_arts where teacher_id=$1`, [t3])).rows.length === 1)
check('old data untouched', (await one(`select count(*)::int c from public.teacher_specialties`)).c === 4 && (await one(`select specialty_id from public.classes where id=$1`, [cBjj])).specialty_id === spBjj)

// ---- Landing reads the art ----------------------------------------------------------------------------------------
const land = (await as(db, null, `select public.school_landing('dojo-uno') l`)).rows[0].l
check('landing schedule shows the art as discipline', land?.schedule?.[0]?.discipline === 'Jiu-jitsu brasileño', land?.schedule)
check('landing still readable by anon', Boolean(land))

// ---- set_teacher_arts ---------------------------------------------------------------------------------------------
const set = await tryAs(db, ADM, `select public.set_teacher_arts($1, array[$2,$3]::uuid[])`, [t2, bjjArt, judoArt])
check('admin sets a teacher arts', set.ok, set.err)
check('set replaces the list', (await db.query(`select art_id from public.teacher_arts where teacher_id=$1`, [t2])).rows.map((r) => r.art_id).sort().join() === [bjjArt, judoArt].sort().join())
const dupSet = await tryAs(db, ADM, `select public.set_teacher_arts($1, array[$2,$2]::uuid[])`, [t2, bjjArt])
check('repeated ids do not fail', dupSet.ok, dupSet.err)
const sc2Art = (await one(`select id from public.school_arts where school_id=$1`, [sc2])).id
check("cannot attach another school's art", !(await tryAs(db, ADM, `select public.set_teacher_arts($1, array[$2]::uuid[])`, [t1, sc2Art])).ok)
check('user role cannot set teacher arts', !(await tryAs(db, USR, `select public.set_teacher_arts($1, array[$2]::uuid[])`, [t1, judoArt])).ok)
check('user role cannot insert teacher_arts directly', !(await tryAs(db, USR, `insert into public.teacher_arts (teacher_id, art_id, school_id) values ($1,$2,$3)`, [t1, judoArt, sc])).ok)
check('anon cannot call set_teacher_arts', !(await tryAs(db, null, `select public.set_teacher_arts($1, array[]::uuid[])`, [t1])).ok)
check('anon cannot read teacher_arts', !(await tryAs(db, null, `select * from public.teacher_arts`)).ok)
check('user reads teacher_arts of the school', (await as(db, USR, `select count(*)::int c from public.teacher_arts`)).rows[0].c >= 2)
check('other owner sees no teacher_arts of school 1', (await as(db, OWNER2, `select count(*)::int c from public.teacher_arts where school_id=$1`, [sc])).rows[0].c === 0)
const upd = await tryAs(db, ADM, `update public.teacher_arts set art_id=$1 where teacher_id=$2`, [mmaArt, t2])
check('teacher_arts rows are not updatable (replace instead)', !upd.ok || upd.affected === 0, upd.err)

// ---- classes / plans FK -------------------------------------------------------------------------------------------
check("class cannot use another school's art", !(await tryAs(db, ADM, `update public.classes set art_id=$1 where id=$2`, [sc2Art, cNone])).ok)
check("plan cannot use another school's art", !(await tryAs(db, ADM, `update public.plans set art_id=$1 where id=$2`, [sc2Art, pJudo])).ok)
await db.query(`delete from public.school_arts where id=$1`, [mmaArt])
check('deleting an art leaves its classes as "all"', (await one(`select art_id, school_id from public.classes where id=$1`, [cMma])).art_id === null)
check('deleting an art drops it from teachers', (await db.query(`select 1 from public.teacher_arts where art_id=$1`, [mmaArt])).rows.length === 0)

report()
