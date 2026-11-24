// Classes without attendance: the team can mark a session as "not held" (only its own school, not future ones).
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const OWNER = await newUser(db, 'owner'), USR = await newUser(db, 'profe'), STU = await newUser(db, 'alumno'), OTHER = await newUser(db, 'otro')
await db.query(`insert into public.owners (user_id) values ($1), ($2)`, [OWNER, OTHER])
const sc = (await as(db, OWNER, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
await as(db, OTHER, `select public.create_school('Dojo Dos','dojo-dos')`)
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'user')`, [sc, USR])
await as(db, OWNER, `insert into public.students (school_id, first_name, first_last_name, rut, user_id) values ($1,'Ana','Paz','11111111-1',$2)`, [sc, STU])
const cls = (await as(db, OWNER, `insert into public.classes (school_id, name, color) values ($1,'Fundamentales','#3d9be0') returning id`, [sc])).rows[0].id
const mk = async (days) => (await db.query(`insert into public.class_sessions (school_id, class_id, date, start_time, end_time, name)
  values ($1,$2,current_date + $3::int,'20:00','21:00','Fundamentales') returning id`, [sc, cls, days])).rows[0].id
const past = await mk(-2), future = await mk(3)
const set = (u, id, v = true) => tryAs(db, u, `select public.set_session_not_held($1,$2)`, [id, v])

check('a teacher ("usuario") marks a past class as not held', (await set(USR, past)).ok)
check('stored', (await db.query(`select not_held from public.class_sessions where id=$1`, [past])).rows[0].not_held === true)
check('audited', (await db.query(`select count(*)::int c from public.audit_log where action='session_not_held'`)).rows[0].c === 1)
check('undo', (await set(OWNER, past, false)).ok && (await db.query(`select not_held from public.class_sessions where id=$1`, [past])).rows[0].not_held === false)
check('future sessions cannot be marked', /future session/.test((await set(OWNER, future)).err ?? ''))
check('a student cannot', !(await set(STU, past)).ok)
check('another school cannot', !(await set(OTHER, past)).ok)
check('anon cannot', !(await set(null, past)).ok)
check('no direct updates', (await tryAs(db, USR, `update public.class_sessions set not_held = true where id=$1`, [past])).affected !== 1)
report()
