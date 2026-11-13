// Free trial booking from the landing page, and the per-school task board (Tareas).
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const O1 = await newUser(db, 'dueno1'), O2 = await newUser(db, 'dueno2'), M = await newUser(db, 'staff1'), Z = await newUser(db, 'nadie')
await db.query(`select set_config('request.jwt.claims', '{}', false)`)
await db.query(`select public.register_owner($1), public.register_owner($2)`, [O1, O2])
const a = (await as(db, O1, `select (public.create_school('Dojo A','dojo-a')).id`)).rows[0].id
const b = (await as(db, O2, `select (public.create_school('Dojo B','dojo-b')).id`)).rows[0].id
await as(db, O1, `insert into public.school_members (school_id, user_id, role) values ($1,$2,'user')`, [a, M])

// Slots: admin only
const tomorrow = (await db.query(`select ((now() at time zone 'America/Santiago')::date + 1) d, extract(isodow from (now() at time zone 'America/Santiago')::date + 1)::int w`)).rows[0]
const day = tomorrow.d.toISOString().slice(0, 10), wd = tomorrow.w
const slot = (await as(db, O1, `insert into public.trial_slots (school_id, weekday, start_time, end_time, capacity) values ($1,$2,'19:00','20:00',1) returning id`, [a, wd])).rows[0].id
const staffSlot = await tryAs(db, M, `insert into public.trial_slots (school_id, weekday, start_time, end_time) values ($1,1,'10:00','11:00')`, [a])
check('staff (user role) cannot create slots', !staffSlot.ok, staffSlot.err)
const xSlot = await tryAs(db, O2, `insert into public.trial_slots (school_id, weekday, start_time, end_time) values ($1,1,'10:00','11:00')`, [a])
check("another owner cannot create slots in my school", !xSlot.ok, xSlot.err)
const badTime = await tryAs(db, O1, `insert into public.trial_slots (school_id, weekday, start_time, end_time) values ($1,1,'11:00','10:00')`, [a])
check('slot must end after it starts', !badTime.ok, badTime.err)

// Landing: hidden until enabled
let L = (await as(db, null, `select public.school_landing('dojo-a') l`)).rows[0].l
check('trial block is hidden while disabled', L.trial === null, L.trial)
const off = await tryAs(db, null, `select public.book_trial('dojo-a',$1,$2,'Pedro','+56 9 1111 1111')`, [slot, day])
check('cannot book while disabled', !off.ok, off.err)
await as(db, O1, `update public.schools set trial_enabled=true, trial_note='Trae ropa cómoda' where id=$1`, [a])
L = (await as(db, null, `select public.school_landing('dojo-a') l`)).rows[0].l
check('landing lists upcoming slot dates', L.trial.note === 'Trae ropa cómoda' && L.trial.slots.length === 3 && L.trial.slots[0].date === day && L.trial.slots[0].free === 1, L.trial)
check('trial_availability is not directly callable', !(await tryAs(db, null, `select public.trial_availability($1)`, [a])).ok)

// Booking
const bk = await tryAs(db, null, `select public.book_trial('dojo-a',$1,$2,'Pedro Pérez','+56 9 1111 1111','pedro@test.cl','Nunca he entrenado') id`, [slot, day])
check('a visitor books a trial class', bk.ok, bk.err)
const full = await tryAs(db, null, `select public.book_trial('dojo-a',$1,$2,'Otra','+56 9 2222 2222')`, [slot, day])
check('a full slot rejects more bookings', !full.ok && full.err.includes('slot full'), full.err)
const wrongDay = await tryAs(db, null, `select public.book_trial('dojo-a',$1,($2::date + 1),'Otra','+56 9 2222 2222')`, [slot, day])
check('date must match the slot weekday', !wrongDay.ok, wrongDay.err)
const past = await tryAs(db, null, `select public.book_trial('dojo-a',$1,($2::date - 7),'Otra','+56 9 2222 2222')`, [slot, day])
check('cannot book in the past or today', !past.ok, past.err)
const otherSchool = await tryAs(db, null, `select public.book_trial('dojo-b',$1,$2,'Otra','+56 9 2222 2222')`, [slot, day])
check("cannot book a slot of another school", !otherSchool.ok, otherSchool.err)
await tryAs(db, null, `select public.book_trial('dojo-a',$1,($2::date + 7),'Pedro','+56911111111')`, [slot, day])
const spam = await tryAs(db, null, `select public.book_trial('dojo-a',$1,($2::date + 14),'Pedro','+56 9 1111-1111')`, [slot, day])
check('same phone limited to 2 upcoming bookings', !spam.ok && spam.err.includes('too many'), spam.err)
L = (await as(db, null, `select public.school_landing('dojo-a') l`)).rows[0].l
check('landing shows the slot as full', L.trial.slots[0].free === 0)
check('landing exposes no booking data', !JSON.stringify(L).includes('Pedro'))
{ const r = await tryAs(db, null, `select * from public.trial_bookings`); check('visitors cannot read bookings', !r.ok || r.rows.length === 0, r.err) }

// Booking became a task for the school
const t = (await as(db, M, `select * from public.tasks`)).rows
check('booking creates a task visible to staff', t.length === 2 && t.every((x) => x.kind === 'clase_prueba' && x.status === 'por_hacer') && t.some((x) => x.title.startsWith('Clase de prueba: Pedro Pérez') && x.notes.includes('+56 9 1111 1111')), t)
check('staff see the bookings', (await as(db, M, `select count(*)::int c from public.trial_bookings`)).rows[0].c === 2)
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
