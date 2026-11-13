// Student self-signup via a per-school link: auto-link on RUT+email match, otherwise admin decides.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), A = await newUser(db, 'ana'), U = await newUser(db, 'uri'), X = await newUser(db, 'xavi')
await db.query(`select public.grant_ceo('ceo@test.cl')`)
const s1 = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const s2 = (await as(db, CEO, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user'), ($4,$5,'admin')`, [s1, A, U, s2, X])
const asService = async (sql, params = []) => { await db.query(`select set_config('request.jwt.claims', '{}', false)`); return db.query(sql, params) }
const reg = (code, user, rut, email, first = 'Ana', last = 'Pérez') =>
  asService(`select public.register_student_signup($1,$2,$3,$4,$5,$6,null) r`, [code, user, first, last, rut, email]).then((r) => r.rows[0].r)

const code = (await db.query(`select signup_code c, signup_enabled e from public.schools where id=$1`, [s1])).rows[0]
check('every school gets a sign-up code, disabled by default', /^[a-z2-9]{10}$/.test(code.c) && code.e === false, code)
check('disabled link: public lookup returns nothing', (await as(db, null, `select count(*)::int c from public.signup_school($1)`, [code.c])).rows[0].c === 0)
const uOn = await tryAs(db, U, `update public.schools set signup_enabled=true where id=$1`, [s1])
check('user role cannot open the link', !uOn.ok || uOn.affected === 0, uOn.err)
await as(db, A, `update public.schools set signup_enabled=true where id=$1`, [s1])
const pub = (await as(db, null, `select * from public.signup_school($1)`, [code.c])).rows
check('anyone with the link sees only the school name/logo', pub.length === 1 && pub[0].name === 'Dojo Uno' && Object.keys(pub[0]).length === 3, pub)

const known = (await as(db, A, `insert into public.students (school_id, first_name, first_last_name, rut, email) values ($1,'Sofía','Rojas','11111111-1','sofi@test.cl') returning id`, [s1])).rows[0].id

// Auto-link: RUT (any format) + email (any case) match
const S1 = await newUser(db, 'sofi-acc')
const r1 = await reg(code.c, S1, '11.111.111-1', 'SOFI@test.cl', 'Sofía', 'Rojas')
check('matching RUT + email links the account right away', r1.linked === true, r1)
check('the student now uses that account', (await db.query(`select user_id from public.students where id=$1`, [known])).rows[0].user_id === S1)
check('the linked student reaches the portal', (await as(db, S1, `select count(*)::int c from public.students`)).rows[0].c === 1)

// RUT matches but email does not → pending (no hijacking with just a RUT)
const S2 = await newUser(db, 'intruso')
const r2 = await reg(code.c, S2, '11111111-1', 'otro@test.cl')
check('RUT match with a different email stays pending', r2.linked === false)
const known2 = (await as(db, A, `insert into public.students (school_id, first_name, first_last_name, rut, email) values ($1,'Beto','Soto','12345678-5','beto@test.cl') returning id`, [s1])).rows[0].id
const S3 = await newUser(db, 'beto-acc')
await reg(code.c, S3, '12345678-5', 'beto-otro@test.cl', 'Beto', 'Soto')
const S4 = await newUser(db, 'nuevo-acc')
await reg(code.c, S4, '7654321-6', 'nuevo@test.cl', 'Nuevo', 'Alumno')

check('pending requests give no portal access', (await as(db, S4, `select count(*)::int c from public.classes`)).rows[0].c === 0)
check('applicant sees their own request', (await as(db, S4, `select status from public.student_signups`)).rows.map((r) => r.status).join() === 'pendiente')
check('user role does not see requests', (await as(db, U, `select count(*)::int c from public.student_signups`)).rows[0].c === 0)
check('admin sees the 4 requests', (await as(db, A, `select count(*)::int c from public.student_signups`)).rows[0].c === 4)
check('admin of another school sees none', (await as(db, X, `select count(*)::int c from public.student_signups`)).rows[0].c === 0)

const reqOf = async (u) => (await db.query(`select id from public.student_signups where user_id=$1`, [u])).rows[0].id
const uDec = await tryAs(db, U, `select public.decide_student_signup($1,'create')`, [await reqOf(S4)])
check('user role cannot approve', !uDec.ok, uDec.err)
const linkTaken = await tryAs(db, A, `select public.decide_student_signup($1,'link',$2)`, [await reqOf(S2), known])
check('cannot link to a student that already has an account', !linkTaken.ok, linkTaken.err)
await as(db, A, `select public.decide_student_signup($1,'link',$2)`, [await reqOf(S3), known2])
check('admin links a request to an existing student', (await db.query(`select user_id from public.students where id=$1`, [known2])).rows[0].user_id === S3)
const created = (await as(db, A, `select public.decide_student_signup($1,'create') id`, [await reqOf(S4)])).rows[0].id
const ns = (await db.query(`select first_name, rut, email, user_id from public.students where id=$1`, [created])).rows[0]
check('admin creates a new student from the request', ns.first_name === 'Nuevo' && ns.user_id === S4 && ns.email === 'nuevo@test.cl', ns)
await as(db, A, `select public.decide_student_signup($1,'reject')`, [await reqOf(S2)])
check('rejected request leaves no access', (await as(db, S2, `select count(*)::int c from public.students`)).rows[0].c === 0)
const again = await tryAs(db, A, `select public.decide_student_signup($1,'create')`, [await reqOf(S2)])
check('a decided request cannot be decided again', !again.ok, again.err)

const direct = await tryAs(db, S2, `select public.register_student_signup($1,$2,'a','b','11111111-1','x@test.cl',null)`, [code.c, S2])
check('clients cannot call the registration function directly', !direct.ok, direct.err)
const ins = await tryAs(db, S2, `insert into public.student_signups (school_id, user_id, first_name, first_last_name, rut, email) values ($1,$2,'a','b','11111111-1','x@test.cl')`, [s1, S2])
check('clients cannot write requests directly', !ins.ok, ins.err)
const bad = await asService(`select public.register_student_signup('nope',$1,'a','b','11111111-1','x@test.cl',null)`, [S2]).then(() => true, () => false)
check('invalid code is rejected', bad === false)
const newCode = (await as(db, A, `select public.regenerate_signup_code($1) c`, [s1])).rows[0].c
check('admin can rotate the link (old one stops working)', newCode !== code.c && (await as(db, null, `select count(*)::int c from public.signup_school($1)`, [code.c])).rows[0].c === 0)
const xRot = await tryAs(db, X, `select public.regenerate_signup_code($1)`, [s1])
check('admin of another school cannot rotate it', !xRot.ok, xRot.err)
report()
