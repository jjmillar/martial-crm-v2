// Apoderados: a student asks for a child, the admin approves, the guardian acts for the child, then hands the
// account over with a one-time code and the child keeps attendance/XP.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const OWNER = await newUser(db, 'owner'), ADM = await newUser(db, 'adm'), USR = await newUser(db, 'usr'), MOM = await newUser(db, 'mama'), OTHER = await newUser(db, 'otro'), KID = await newUser(db, 'tomas')
await db.query(`insert into public.owners (user_id) values ($1)`, [OWNER])
const sc = (await as(db, OWNER, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user')`, [sc, ADM, USR])
const mom = (await as(db, OWNER, `insert into public.students (school_id, first_name, first_last_name, rut, user_id) values ($1,'Carla','Soto','11111111-1',$2) returning id`, [sc, MOM])).rows[0].id
await as(db, OWNER, `insert into public.students (school_id, first_name, first_last_name, rut, user_id) values ($1,'Otro','Alumno','7654321-6',$2)`, [sc, OTHER])
const cls = (await as(db, OWNER, `insert into public.classes (school_id, name, color) values ($1,'Infantil','#3d9be0') returning id`, [sc])).rows[0].id
await db.query(`insert into public.class_schedules (school_id, class_id, weekday, start_time, end_time) select $2, $1, d, '00:00', '23:59' from generate_series(1,7) d`, [cls, sc])

const req = (user, rut = '22222222-2') => tryAs(db, user, `select public.request_child($1,'Tomás',null,'Soto','Pérez',$2,'tomas@mail.cl','2015-03-01','Calle 1 123') id`, [sc, rut])
check('a non-student cannot ask for a child', !(await req(KID)).ok)
const r1 = await req(MOM)
check('a student asks for a child', r1.ok, r1.err)
check('same RUT cannot be requested twice', !(await req(MOM)).ok)
check('a RUT that is already a student cannot be requested', /already a student/.test((await req(MOM, '7654321-6')).err ?? ''))
check('guardian sees own request', (await as(db, MOM, `select count(*)::int c from public.child_requests`)).rows[0].c === 1)
check('another student does not see it', (await as(db, OTHER, `select count(*)::int c from public.child_requests`)).rows[0].c === 0)
check('admin sees it', (await as(db, ADM, `select count(*)::int c from public.child_requests`)).rows[0].c === 1)
check('a "usuario" member does not see it', (await as(db, USR, `select count(*)::int c from public.child_requests`)).rows[0].c === 0)
check('no direct inserts', !(await tryAs(db, MOM, `insert into public.child_requests (school_id, guardian_id, first_name, first_last_name, second_last_name, rut, email, birth_date, address) values ($1,$2,'X','Y','Z','22222222-2','a@b.cl','2010-01-01','x')`, [sc, MOM])).ok)

const rid = r1.rows[0].id
check('guardian cannot approve', !(await tryAs(db, MOM, `select public.decide_child_request($1, true)`, [rid])).ok)
check('a "usuario" member cannot approve', !(await tryAs(db, USR, `select public.decide_child_request($1, true)`, [rid])).ok)
const ap = await tryAs(db, ADM, `select public.decide_child_request($1, true) sid`, [rid])
check('admin approves → child student created', ap.ok && ap.rows[0].sid, ap.err)
const kid = ap.rows[0].sid
const krow = (await db.query(`select user_id, rut, email, birth_date::text b, address, second_last_name from public.students where id=$1`, [kid])).rows[0]
check('child has the same data and no login', krow.user_id === null && krow.rut === '22222222-2' && krow.b === '2015-03-01' && krow.address === 'Calle 1 123' && krow.second_last_name === 'Pérez', krow)
check('decided twice fails', !(await tryAs(db, ADM, `select public.decide_child_request($1, false)`, [rid])).ok)

// Guardian acts for the child
check('guardian reads the child record', (await as(db, MOM, `select count(*)::int c from public.students where id=$1`, [kid])).rows[0].c === 1)
check('another student does not', (await as(db, OTHER, `select count(*)::int c from public.students where id=$1`, [kid])).rows[0].c === 0)
check('guardian reads the child progress', (await tryAs(db, MOM, `select public.student_progress($1)`, [kid])).ok)
check('another student cannot read it', !(await tryAs(db, OTHER, `select public.student_progress($1)`, [kid])).ok)
const ci = await tryAs(db, MOM, `select (public.check_in_for($1,$2,current_date)).id`, [kid, cls])
check('guardian marks the child attendance', ci.ok, ci.err)
const arow = (await db.query(`select self_marked, confirmed_at, marked_by from public.attendance where student_id=$1`, [kid])).rows[0]
check('it is pending and stamped with the guardian', arow.self_marked && arow.confirmed_at === null && arow.marked_by === MOM, arow)
check('guardian can also mark their own', (await tryAs(db, MOM, `select public.check_in_for($1,$2,current_date)`, [mom, cls])).ok)
check('old entry point marks only the own record', (await tryAs(db, MOM, `select public.check_in_on($1,current_date)`, [cls])).ok && (await db.query(`select count(*)::int c from public.attendance where class_id=$1`, [cls])).rows[0].c === 2)
check('another student cannot mark the child', !(await tryAs(db, OTHER, `select public.check_in_for($1,$2,current_date)`, [kid, cls])).ok)
await as(db, MOM, `select public.undo_check_in_on($1,current_date)`, [cls])
check('undoing own check-in leaves the child one', (await db.query(`select count(*)::int c from public.attendance where class_id=$1`, [cls])).rows[0].c === 1)
await as(db, MOM, `select public.check_in_for($1,$2,current_date)`, [mom, cls])
await as(db, ADM, `select public.review_attendance(array(select id from public.attendance where student_id=$1), true)`, [kid])
{ const x = await tryAs(db, MOM, `select (public.student_progress($1)->>'xp')::int x`, [kid]); check('approved child attendance adds XP', x.ok && x.rows[0].x === 10, x.err) }
check('guardian edits the child record', (await tryAs(db, MOM, `select public.update_my_student($1,'+56911111111','2015-03-01','Calle 2',null,null,null)`, [kid])).ok)
check('another student cannot', !(await tryAs(db, OTHER, `select public.update_my_student($1,null,null,null,null,null,null)`, [kid])).ok)
check('child public profile is private by default', (await as(db, MOM, `select count(*)::int c from public.student_profiles where student_id=$1 and published`, [kid])).rows[0].c === 0)
check('guardian can configure the child profile', (await tryAs(db, MOM, `select public.save_my_public_profile($1,'tomas-soto',false,null,null,true,true,true)`, [kid])).ok)
check('guardian sees the child payments', (await (async () => { await as(db, OWNER, `insert into public.payments (school_id, student_id, concept, amount) values ($1,$2,'Mensualidad',20000)`, [sc, kid]); return (await as(db, MOM, `select count(*)::int c from public.payments where student_id=$1`, [kid])).rows[0].c === 1 })()))
check('staff sees who the guardian is', (await as(db, USR, `select count(*)::int c from public.student_guardians where student_id=$1`, [kid])).rows[0].c === 1)
check('another student does not', (await as(db, OTHER, `select count(*)::int c from public.student_guardians`)).rows[0].c === 0)

// Inactive guardian record: still reaches the school through the child
await as(db, OWNER, `update public.students set active=false where id=$1`, [mom])
check('guardian with inactive own record still reaches the school', (await as(db, MOM, `select public.is_student_user($1) v`, [sc])).rows[0].v === true)
await as(db, OWNER, `update public.students set active=true where id=$1`, [mom])

// Hand over the account
check('another student cannot create a code', !(await tryAs(db, OTHER, `select public.create_student_claim($1)`, [kid])).ok)
const cc = await tryAs(db, MOM, `select public.create_student_claim($1) c`, [kid])
check('guardian creates a code', cc.ok && /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(cc.rows[0].c.code), cc.err ?? cc.rows?.[0])
const code = cc.rows[0].c.code
check('codes are stored hashed', (await db.query(`select count(*)::int c from public.student_claims where code_hash = $1`, [code])).rows[0].c === 0)
check('no one reads claims directly', !(await tryAs(db, MOM, `select * from public.student_claims`)).ok)
check('claim info is not callable by users', !(await tryAs(db, KID, `select public.student_claim_info($1)`, [code])).ok)
check('claim_student_as is not callable by users', !(await tryAs(db, KID, `select public.claim_student_as($1,$2,null)`, [code, KID])).ok)
check('a wrong code fails', !(await tryAs(db, KID, `select public.claim_student('AAAA-BBBB-CCCC')`)).ok)
const cl = await tryAs(db, KID, `select public.claim_student($1) id`, [code.toLowerCase().replace(/-/g, ' ')])
check('the child claims with the code (any case/format)', cl.ok && cl.rows[0].id === kid, cl.err)
const after = (await db.query(`select user_id, email from public.students where id=$1`, [kid])).rows[0]
check('record now belongs to the child login, email updated', after.user_id === KID && after.email === 'tomas@test.cl', after)
check('guardian link ended', (await db.query(`select count(*)::int c from public.student_guardians where student_id=$1`, [kid])).rows[0].c === 0)
check('guardian no longer reads the child', (await as(db, MOM, `select count(*)::int c from public.students where id=$1`, [kid])).rows[0].c === 0)
{ const x = await tryAs(db, KID, `select (public.student_progress($1)->>'xp')::int x`, [kid]); check('child keeps the XP', x.ok && x.rows[0].x === 10, x.err ?? x.rows[0]) }
check('code works only once', !(await tryAs(db, OTHER, `select public.claim_student($1)`, [code])).ok)
check('anon cannot call any of it', !(await tryAs(db, null, `select public.request_child($1,'a',null,'b','c','22222222-2','a@b.cl','2010-01-01','x')`, [sc])).ok)
report()
