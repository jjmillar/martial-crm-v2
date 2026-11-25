// Check-in by QR: only admins read/rotate the school's code; a signed-in student scanning it gets today's class
// confirmed from 1 h before the start until the end; a guardian chooses who; an old code stops working.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const OWNER = await newUser(db, 'owner'), ADM = await newUser(db, 'adm'), STAFF = await newUser(db, 'profe'), ST = await newUser(db, 'alumna')
const MOM = await newUser(db, 'mama'), OTHER = await newUser(db, 'otro'), STRANGER = await newUser(db, 'x')
await db.query(`insert into public.owners (user_id) values ($1), ($2)`, [OWNER, OTHER])
const sc = (await as(db, OWNER, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const sc2 = (await as(db, OTHER, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user')`, [sc, ADM, STAFF])
const mkSt = async (school, first, user) => (await as(db, school === sc ? OWNER : OTHER, `insert into public.students (school_id, first_name, first_last_name, user_id) values ($1,$2,'Uno',$3) returning id`, [school, first, user])).rows[0].id
const ana = await mkSt(sc, 'Ana', ST)
const mom = await mkSt(sc, 'Marta', MOM), kid = await mkSt(sc, 'Tito', null)
await db.query(`insert into public.student_guardians (student_id, guardian_id, school_id) values ($1,$2,$3)`, [kid, MOM, sc])
const away = await mkSt(sc2, 'Lejana', STRANGER)

// Codes ----------------------------------------------------------------------------------------------------------
check('a user (non-admin) cannot create the code', !(await tryAs(db, STAFF, `select public.rotate_check_in_code($1)`, [sc])).ok)
check('a student cannot create the code', !(await tryAs(db, ST, `select public.rotate_check_in_code($1)`, [sc])).ok)
check('anon cannot create the code', !(await tryAs(db, null, `select public.rotate_check_in_code($1)`, [sc])).ok)
check("another school's owner cannot create it", !(await tryAs(db, OTHER, `select public.rotate_check_in_code($1)`, [sc])).ok)
const t1 = (await as(db, ADM, `select public.rotate_check_in_code($1) t`, [sc])).rows[0].t
check('admin creates a 32-hex code', /^[0-9a-f]{32}$/.test(t1), t1)
check('admin reads it', (await as(db, ADM, `select token from public.school_check_in_codes where school_id=$1`, [sc])).rows[0]?.token === t1)
check('a user cannot read it', (await as(db, STAFF, `select count(*)::int c from public.school_check_in_codes`)).rows[0].c === 0)
check('a student cannot read it', (await as(db, ST, `select count(*)::int c from public.school_check_in_codes`)).rows[0].c === 0)
check('no direct writes', !(await tryAs(db, ADM, `update public.school_check_in_codes set token=repeat('a',32) where school_id=$1`, [sc])).ok
  || (await db.query(`select token from public.school_check_in_codes where school_id=$1`, [sc])).rows[0].token === t1)
check('rotation is audited', (await db.query(`select count(*)::int c from public.audit_log where action='check_in_code_rotated'`)).rows[0].c === 1)

// Scans -------------------------------------------------------------------------------------------------------------
const clock = (await db.query(`select extract(hour from now() at time zone 'America/Santiago')::int h,
  extract(isodow from (now() at time zone 'America/Santiago')::date)::int w, (now() at time zone 'America/Santiago')::date::text d`)).rows[0]
const scan = (user, token, sid = null, lat = null, lng = null) => as(db, user, `select public.qr_check_in($1,$2,$3,$4) r`, [token, sid, lat, lng]).then((x) => x.rows[0].r)

check('invalid token is rejected', (await scan(ST, 'zz')).error === 'invalid_code' && (await scan(ST, '0'.repeat(32))).error === 'invalid_code')
check('anon cannot call it', !(await tryAs(db, null, `select public.qr_check_in($1)`, [t1])).ok)
check('a non-student of the school is refused', (await scan(STRANGER, t1)).error === 'not_student')
check('no class right now → no_class', (await scan(ST, t1)).error === 'no_class')

if (clock.h >= 4 && clock.h < 20) {
  const mkClass = async (name, fromNowMin, lenMin) => {
    const c = (await as(db, OWNER, `insert into public.classes (school_id, name) values ($1,$2) returning id`, [sc, name])).rows[0].id
    await as(db, OWNER, `insert into public.class_schedules (school_id, class_id, weekday, start_time, end_time)
      values ($1,$2,$3, ((now() at time zone 'America/Santiago') + make_interval(mins => $4))::time, ((now() at time zone 'America/Santiago') + make_interval(mins => $5))::time)`,
      [sc, c, clock.w, fromNowMin, fromNowMin + lenMin])
    return c
  }
  await mkClass('Terminada', -180, 60)
  const far = await mkClass('Más tarde', 150, 60)
  let r = await scan(ST, t1)
  check('class 2.5 h away is not open yet → no_class with the next one', r.error === 'no_class' && r.next?.name === 'Más tarde', r)
  const soon = await mkClass('Pronto', 40, 60)
  r = await scan(ST, t1)
  check('40 min before the start → marked', r.ok && r.class === 'Pronto' && !r.already, r)
  const row = (await db.query(`select self_marked, by_qr, confirmed_at, confirmed_by, marked_by from public.attendance where class_id=$1 and student_id=$2`, [soon, ana])).rows[0]
  check('confirmed on the spot, by QR, stamped by the student', row?.by_qr && row.confirmed_at !== null && row.confirmed_by === ST && row.marked_by === ST, row)
  check('it counts for XP right away', (await as(db, ST, `select (public.student_progress($1)->>'xp')::int x`, [ana])).rows[0].x === 10)
  r = await scan(ST, t1)
  check('scanning again says already marked (no duplicate)', r.ok && r.already, r)
  check('one row only', (await db.query(`select count(*)::int c from public.attendance where student_id=$1`, [ana])).rows[0].c === 1)
  const early = await tryAs(db, MOM, `select public.check_in($1)`, [soon])
  check('the app check-in still waits for the start (marker not left on)', !early.ok && /class not started/.test(early.err), early.err)
  const staffEarly = await tryAs(db, STAFF, `insert into public.attendance (school_id, class_id, student_id, date) values ($1,$2,$3,$4)`, [sc, far, mom, clock.d])
  check('staff still cannot mark before the start', !staffEarly.ok && /class not started/.test(staffEarly.err), staffEarly.err)

  const ongoing = await mkClass('En curso', -20, 60)
  r = await scan(ST, t1)
  check('with two open classes it picks the closest start (started 20 min ago)', r.ok && r.class === 'En curso', r)

  // Guardian: own record + child → must choose; choosing someone else is refused.
  r = await scan(MOM, t1)
  check('guardian with a child is asked who', Array.isArray(r.choose) && r.choose.length === 2, r)
  r = await scan(MOM, t1, kid)
  check('guardian checks in the child', r.ok && r.student.startsWith('Tito'), r)
  check("guardian cannot check in someone else's child", (await scan(MOM, t1, ana)).error === 'not_student')
  check('a student of another school cannot use the id trick', (await scan(STRANGER, t1, away)).error === 'not_student')

  // Rotation: old code dead.
  const t2 = (await as(db, OWNER, `select public.rotate_check_in_code($1) t`, [sc])).rows[0].t
  check('rotating gives a new code', t2 !== t1)
  check('the old code stops working', (await scan(MOM, t1, mom)).error === 'invalid_code')
  check('the new one works', (await scan(MOM, t2, mom)).ok)
  await db.query(`update public.classes set active=false where id=$1`, [ongoing])

  // Location: school coordinates from its address; within 150 m confirmed, farther or unknown → pending request.
  const GEO = await newUser(db, 'geo')
  const geo = await mkSt(sc, 'Gina', GEO)
  await as(db, OWNER, `update public.schools set address='Av. Siempre Viva 742', city='Santiago' where id=$1`, [sc])
  await as(db, ADM, `update public.schools set geo_lat=-33.4372, geo_lng=-70.6506, geo_address='Av. Siempre Viva 742, Santiago' where id=$1`, [sc])
  check('a student cannot set the school coordinates', (await tryAs(db, GEO, `update public.schools set geo_lat=0, geo_lng=0 where id=$1 returning id`, [sc])).rows?.length !== 1
    && (await db.query(`select geo_lat from public.schools where id=$1`, [sc])).rows[0].geo_lat === -33.4372)
  r = await scan(GEO, t2)
  check('no phone location → pending (no_location), not confirmed', r.pending && r.reason === 'no_location' && !r.ok, r)
  let g = (await db.query(`select confirmed_at, by_qr, qr_distance_m from public.attendance where student_id=$1`, [geo])).rows[0]
  check('stored as a pending QR request', g.confirmed_at === null && g.by_qr && g.qr_distance_m === null, g)
  check('no XP while pending', (await as(db, GEO, `select (public.student_progress($1)->>'xp')::int x`, [geo])).rows[0].x === 0)
  r = await scan(GEO, t2, null, -33.4600, -70.6506) // ~2.5 km south
  check('2.5 km away → pending (far) with the distance', r.pending && r.reason === 'far' && r.distance > 2000 && r.distance < 3000, r)
  g = (await db.query(`select confirmed_at, qr_distance_m from public.attendance where student_id=$1`, [geo])).rows[0]
  check('only the distance is stored (still pending)', g.confirmed_at === null && g.qr_distance_m === r.distance, g)
  r = await scan(GEO, t2, null, -33.4380, -70.6506) // ~90 m
  check('then within 150 m → confirmed', r.ok && !r.pending && r.distance < 150, r)
  check('one row, confirmed', (await db.query(`select count(*)::int c, bool_and(confirmed_at is not null) ok from public.attendance where student_id=$1`, [geo])).rows[0].ok)
  check('no coordinate columns on attendance', (await db.query(`select count(*)::int c from information_schema.columns where table_name='attendance' and column_name ~ '(lat|lng|lon)'`)).rows[0].c === 0)
  await as(db, OWNER, `update public.schools set address='Otra calle 1' where id=$1`, [sc])
  check('changing the address clears the old coordinates', (await db.query(`select geo_lat, geo_address from public.schools where id=$1`, [sc])).rows[0].geo_lat === null)
  const GEO2 = await newUser(db, 'geo2'), geo2 = await mkSt(sc, 'Gus', GEO2)
  r = await scan(GEO2, t2, null, -10, -10)
  check('school without coordinates → confirmed as before', r.ok && !r.pending, r)
  check('distance_m is not callable by users', !(await tryAs(db, GEO, `select public.distance_m(0,0,1,1)`)).ok)
  void geo2
} else {
  console.log(`(skipped time-window checks: Santiago hour ${clock.h} too close to midnight)`)
}

report()
