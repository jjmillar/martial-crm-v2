// Attendance only once the class has started; students' check-ins are approved or rejected by the team.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const OWNER = await newUser(db, 'owner'), STAFF = await newUser(db, 'profe'), OTHER = await newUser(db, 'otro'), ST = await newUser(db, 'alumna')
await db.query(`insert into public.owners (user_id) values ($1), ($2)`, [OWNER, OTHER])
const sc = (await as(db, OWNER, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
await as(db, OTHER, `select (public.create_school('Dojo Dos','dojo-dos')).id`)
await as(db, OWNER, `insert into public.school_members (school_id, user_id, role) values ($1,$2,'user')`, [sc, STAFF])
const sid = (await as(db, OWNER, `insert into public.students (school_id, first_name, first_last_name, user_id) values ($1,'Ana','Uno',$2) returning id`, [sc, ST])).rows[0].id
const other = (await as(db, OWNER, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Beto','Dos') returning id`, [sc])).rows[0].id
const now = (await db.query(`select (now() at time zone 'America/Santiago')::date::text d, extract(isodow from (now() at time zone 'America/Santiago')::date)::int w, ((now() at time zone 'America/Santiago')::date - 1)::text y, ((now() at time zone 'America/Santiago')::date + 1)::text t`)).rows[0]
const mkClass = async (name, start, end) => {
  const c = (await as(db, OWNER, `insert into public.classes (school_id, name) values ($1,$2) returning id`, [sc, name])).rows[0].id
  await as(db, OWNER, `insert into public.class_schedules (school_id, class_id, weekday, start_time, end_time) values ($1,$2,$3,$4,$5)`, [sc, c, now.w, start, end])
  return c
}
const started = await mkClass('Ya empezó', '00:00', '00:01')
const later = await mkClass('Más tarde', '23:59', '23:59:59')

const staffLater = await tryAs(db, STAFF, `insert into public.attendance (school_id, class_id, student_id, date) values ($1,$2,$3,$4)`, [sc, later, sid, now.d])
check('staff cannot mark before the class starts', !staffLater.ok && /class not started/.test(staffLater.err), staffLater.err)
const staffTomorrow = await tryAs(db, STAFF, `insert into public.attendance (school_id, class_id, student_id, date) values ($1,$2,$3,$4)`, [sc, started, sid, now.t])
check('nobody marks a future date', !staffTomorrow.ok)
const staffNow = await tryAs(db, STAFF, `insert into public.attendance (school_id, class_id, student_id, date) values ($1,$2,$3,$4)`, [sc, started, other, now.d])
check('staff marks once the class has started (confirmed on the spot)', staffNow.ok, staffNow.err)
const past = await tryAs(db, STAFF, `insert into public.attendance (school_id, class_id, student_id, date) values ($1,$2,$3,$4)`, [sc, later, other, now.y])
check('past classes can still be recorded', past.ok, past.err)

const early = await tryAs(db, ST, `select public.check_in($1)`, [later])
check('student cannot check in before the class starts', !early.ok && /class not started/.test(early.err), early.err)
const ci = await tryAs(db, ST, `select (public.check_in($1)).id id`, [started])
check('student checks in once the class has started', ci.ok, ci.err)
const attId = ci.rows[0].id
const row0 = (await db.query(`select self_marked, confirmed_at from public.attendance where id=$1`, [attId])).rows[0]
check('a check-in is a pending request (self-marked, not confirmed)', row0.self_marked && row0.confirmed_at === null)
check('no XP until approved', (await as(db, ST, `select (public.student_progress($1)->>'xp')::int x`, [sid])).rows[0].x === 0)

const outsider = await tryAs(db, OTHER, `select public.review_attendance(array[$1]::uuid[], true)`, [attId])
check('staff of another school cannot approve', !outsider.ok, outsider.err)
const selfApprove = await tryAs(db, ST, `select public.review_attendance(array[$1]::uuid[], true)`, [attId])
check('the student cannot approve their own check-in', !selfApprove.ok, selfApprove.err)
const anon = await tryAs(db, null, `select public.review_attendance(array[$1]::uuid[], true)`, [attId])
check('anon cannot call review_attendance', !anon.ok)

const ok = await tryAs(db, STAFF, `select public.review_attendance(array[$1]::uuid[], true) n`, [attId])
const row1 = (await db.query(`select self_marked, confirmed_by, confirmed_at is not null c from public.attendance where id=$1`, [attId])).rows[0]
check('team approves: confirmed, stamped with who approved, still marked as self check-in', ok.ok && ok.rows[0].n === 1 && row1.c && row1.confirmed_by === STAFF && row1.self_marked, row1)
check('approved attendance gives XP', (await as(db, ST, `select (public.student_progress($1)->>'xp')::int x`, [sid])).rows[0].x === 10)

// Reject flow (past date so the window allows it)
await db.query(`insert into public.attendance (school_id, class_id, student_id, date, self_marked) values ($1,$2,$3,$4,true)`, [sc, later, sid, now.y])
const rej = (await db.query(`select id from public.attendance where class_id=$1 and student_id=$2 and date=$3`, [later, sid, now.y])).rows[0].id
await as(db, OWNER, `select public.review_attendance(array[$1]::uuid[], false)`, [rej])
check('rejecting removes the request', (await db.query(`select count(*)::int c from public.attendance where id=$1`, [rej])).rows[0].c === 0)
check('rejection is written to the audit log', (await db.query(`select count(*)::int c from public.audit_log where action='attendance_rejected' and entity_id=$1`, [rej])).rows[0].c === 1)
const again = await tryAs(db, STAFF, `select public.review_attendance(array[$1]::uuid[], true) n`, [attId])
check('reviewing an already approved one does nothing', again.ok && again.rows[0].n === 0)
report()
