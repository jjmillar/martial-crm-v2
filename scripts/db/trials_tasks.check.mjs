// Free trial booking from the landing page, and the per-school task board (Tareas).
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const O1 = await newUser(db, 'dueno1'), O2 = await newUser(db, 'dueno2'), M = await newUser(db, 'staff1'), Z = await newUser(db, 'nadie')
await db.query(`select set_config('request.jwt.claims', '{}', false)`)
await db.query(`select public.register_owner($1), public.register_owner($2)`, [O1, O2])
const a = (await as(db, O1, `select (public.create_school('Dojo A','dojo-a')).id`)).rows[0].id
const b = (await as(db, O2, `select (public.create_school('Dojo B','dojo-b')).id`)).rows[0].id
await as(db, O1, `insert into public.school_members (school_id, user_id, role) values ($1,$2,'user')`, [a, M])

// Trial slots come from the school's classes (every weekly block of an active class), unlimited places.
const tomorrow = (await db.query(`select ((now() at time zone 'America/Santiago')::date + 1) d, extract(isodow from (now() at time zone 'America/Santiago')::date + 1)::int w`)).rows[0]
const day = tomorrow.d.toISOString().slice(0, 10), wd = tomorrow.w
const q = (sql) => sql
const cls = (await as(db, O1, q("insert into public.classes (school_id, name, description) values ($1,'BJJ Fundamentos','Técnica base para empezar desde cero') returning id"), [a])).rows[0].id
const blk = (await as(db, O1, q("insert into public.class_schedules (school_id, class_id, weekday, start_time, end_time) values ($1,$2,$3,'19:00','20:00') returning id"), [a, cls, wd])).rows[0].id
const off = (await as(db, O1, q("insert into public.classes (school_id, name, active) values ($1,'Clase pausada',false) returning id"), [a])).rows[0].id
const offBlk = (await as(db, O1, q("insert into public.class_schedules (school_id, class_id, weekday, start_time, end_time) values ($1,$2,$3,'07:00','08:00') returning id"), [a, off, wd])).rows[0].id
const longDesc = await tryAs(db, O1, q("update public.classes set description=repeat('x',301) where id=$1"), [cls])
check('class description is capped at 300 characters', !longDesc.ok, longDesc.err)
const landing = async () => (await as(db, null, q("select public.school_landing('dojo-a') l"))).rows[0].l
const book = (slug, blockId, date, name, phone, extra = '') => tryAs(db, null, q("select public.book_trial('" + slug + "',$1," + date + ",'" + name + "','" + phone + "'" + extra + ") id"), [blockId, day])

// Landing: hidden until enabled
let L = await landing()
check('trial block is hidden while disabled', L.trial === null, L.trial)
const offB = await book('dojo-a', blk, '$2', 'Pedro', '+56 9 1111 1111')
check('cannot book while disabled', !offB.ok, offB.err)
check('minimum notice defaults to 24 hours', (await as(db, O1, q('select trial_min_hours h from public.schools where id=$1'), [a])).rows[0].h === 24)
// 48 h of notice: tomorrow's block (at most ~43 h away) is neither offered nor bookable.
await as(db, O1, q('update public.schools set trial_enabled=true, trial_min_hours=48 where id=$1'), [a])
L = await landing()
check('slots inside the notice window are not offered', L.trial.slots.length === 2 && L.trial.slots[0].date !== day, L.trial.slots)
const tooLate = await book('dojo-a', blk, '$2', 'Pedro', '+56 9 1111 1111')
check('booking inside the notice window is rejected', !tooLate.ok && tooLate.err.includes('too late'), tooLate.err)
const badHours = await tryAs(db, O1, q('update public.schools set trial_min_hours=500 where id=$1'), [a])
check('notice is capped at 168 hours', !badHours.ok, badHours.err)
const staffHours = await tryAs(db, M, q('update public.schools set trial_min_hours=0 where id=$1'), [a])
check('staff (user role) cannot change the notice', !staffHours.ok || staffHours.affected === 0, staffHours.err)
await as(db, O1, q("update public.schools set trial_enabled=true, trial_min_hours=0, trial_note='Trae ropa cómoda' where id=$1"), [a])
L = await landing()
const first = L.trial.slots[0]
check('landing lists the class blocks with name and description', L.trial.note === 'Trae ropa cómoda' && L.trial.slots.length === 3 && first.date === day && first.schedule_id === blk && first.name === 'BJJ Fundamentos' && first.description.startsWith('Técnica') && !('free' in first), L.trial)
check('inactive classes are not offered', !L.trial.slots.some((x) => x.schedule_id === offBlk))
check('trial_availability is not directly callable', !(await tryAs(db, null, q('select public.trial_availability($1)'), [a])).ok)

// Booking (unlimited places)
const bk = await book('dojo-a', blk, '$2', 'Pedro Pérez', '+56 9 1111 1111', ",'pedro@test.cl','Nunca he entrenado'")
check('a visitor books a trial class', bk.ok, bk.err)
const many = []
for (let i = 0; i < 4; i++) many.push(await book('dojo-a', blk, '$2', 'Persona ' + i, '+56 9 3333 000' + i))
check('places are unlimited', many.every((r) => r.ok), many.map((r) => r.err))
const row = (await as(db, O1, q("select class_id, schedule_id, class_name from public.trial_bookings where name='Pedro Pérez'"))).rows[0]
check('booking records the class', row.class_id === cls && row.schedule_id === blk && row.class_name === 'BJJ Fundamentos', row)
const inactive = await book('dojo-a', offBlk, '$2', 'Otra', '+56 9 2222 2222')
check('an inactive class cannot be booked', !inactive.ok, inactive.err)
const wrongDay = await book('dojo-a', blk, '($2::date + 1)', 'Otra', '+56 9 2222 2222')
check('date must match the class weekday', !wrongDay.ok, wrongDay.err)
const past = await book('dojo-a', blk, '($2::date - 7)', 'Otra', '+56 9 2222 2222')
check('cannot book in the past', !past.ok, past.err)
const otherSchool = await book('dojo-b', blk, '$2', 'Otra', '+56 9 2222 2222')
check('cannot book a class of another school', !otherSchool.ok, otherSchool.err)
await book('dojo-a', blk, '($2::date + 7)', 'Pedro', '+56911111111')
const spam = await book('dojo-a', blk, '($2::date + 14)', 'Pedro', '+56 9 1111-1111')
check('same phone limited to 2 upcoming bookings', !spam.ok && spam.err.includes('too many'), spam.err)
L = await landing()
check('landing exposes no booking data', !JSON.stringify(L).includes('Pedro'))
{ const r = await tryAs(db, null, q('select * from public.trial_bookings')); check('visitors cannot read bookings', !r.ok || r.rows.length === 0, r.err) }

// Booking became a task for the school
const t = (await as(db, M, `select * from public.tasks`)).rows
check('booking creates a task visible to staff (with the class)', t.length === 6 && t.every((x) => x.kind === 'clase_prueba' && x.status === 'por_hacer') && t.some((x) => x.title.startsWith('Clase de prueba: Pedro Pérez · BJJ Fundamentos') && x.notes.includes('+56 9 1111 1111')), t.map((x) => x.title))
check('staff see the bookings', (await as(db, M, `select count(*)::int c from public.trial_bookings`)).rows[0].c === 6)
check("another owner sees none of it", (await as(db, O2, `select count(*)::int c from public.tasks`)).rows[0].c === 0 && (await as(db, O2, `select count(*)::int c from public.trial_bookings`)).rows[0].c === 0)
check('accounts outside the school see nothing', (await as(db, Z, `select count(*)::int c from public.tasks`)).rows[0].c === 0)

// Tasks: create, move, edit, delete
const mine = (await as(db, M, `insert into public.tasks (school_id, title) values ($1,'Llamar a apoderado') returning id, created_by`, [a])).rows[0]
check('staff create tasks (author recorded)', mine.created_by === M)
const fakeAuto = await tryAs(db, M, `insert into public.tasks (school_id, title, kind) values ($1,'x','clase_prueba')`, [a])
check('automatic task kinds cannot be created from the client', !fakeAuto.ok, fakeAuto.err)
await as(db, O1, `update public.tasks set status='en_curso', title='Llamar a apoderado de Ana' where id=$1`, [mine.id])
const moved = (await as(db, M, `select status, title from public.tasks where id=$1`, [mine.id])).rows[0]
check('tasks move between columns and can be edited', moved.status === 'en_curso' && moved.title.endsWith('Ana'), moved)
const badStatus = await tryAs(db, M, `update public.tasks set status='archivada' where id=$1`, [mine.id])
check('columns are fixed', !badStatus.ok, badStatus.err)
const xEdit = await tryAs(db, O2, `update public.tasks set title='hack' where id=$1`, [mine.id])
check("another owner cannot edit my tasks", !xEdit.ok || xEdit.affected === 0, xEdit.err)
const xIns = await tryAs(db, O2, `insert into public.tasks (school_id, title) values ($1,'hack')`, [a])
check("another owner cannot add tasks to my school", !xIns.ok, xIns.err)
const move = await tryAs(db, M, `update public.tasks set school_id=$2 where id=$1`, [mine.id, b])
check('a task cannot move to another school', !move.ok, move.err)
await as(db, M, `delete from public.tasks where id=$1`, [mine.id])
check('staff delete tasks', (await as(db, M, `select count(*)::int c from public.tasks where id=$1`, [mine.id])).rows[0].c === 0)
report()
