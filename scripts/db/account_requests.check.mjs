// Open sign-up: account requests (student or member) approved by the CEO / school admins.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), A = await newUser(db, 'ana'), U = await newUser(db, 'uri'), X = await newUser(db, 'xavi')
await db.query(`select public.grant_ceo('ceo@test.cl')`)
const s1 = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const s2 = (await as(db, CEO, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user'), ($4,$5,'admin')`, [s1, A, U, s2, X])
const asService = async (sql, params = []) => { await db.query(`select set_config('request.jwt.claims', '{}', false)`); return db.query(sql, params) }
const reg = (school, user, kind, rut, email, first = 'Ana', last = 'Pérez') =>
  asService(`select public.register_account_request($1,$2,$3,$4,$5,$6,$7,null) id`, [school, user, kind, first, last, rut, email]).then((r) => r.rows[0].id)

check('anyone (not signed in) can list schools for the form', (await as(db, null, `select count(*)::int c from public.public_schools()`)).rows[0].c === 2)
check('the public list exposes only id, name, city', Object.keys((await as(db, null, `select * from public.public_schools() limit 1`)).rows[0]).join() === 'id,name,city')

const S1 = await newUser(db, 'alumna'), S2 = await newUser(db, 'alumno2'), M1 = await newUser(db, 'profe'), Z = await newUser(db, 'random')
const existing = (await as(db, A, `insert into public.students (school_id, first_name, first_last_name, rut, email) values ($1,'Sofía','Rojas','11111111-1','sofi@test.cl') returning id`, [s1])).rows[0].id
const r1 = await reg(s1, S1, 'alumno', '11.111.111-1', 'SOFI@test.cl', 'Sofía', 'Rojas')
check('even a perfect RUT + email match is NOT linked automatically', (await db.query(`select user_id from public.students where id=$1`, [existing])).rows[0].user_id === null)
const r2 = await reg(s1, S2, 'alumno', '7654321-6', 'nuevo@test.cl', 'Nuevo', 'Alumno')
const r3 = await reg(s1, M1, 'miembro', null, 'profe@test.cl', 'Pedro', 'Profe')
const r4 = await reg(s2, Z, 'alumno', '12345678-5', 'z@test.cl')
const noRut = await asService(`select public.register_account_request($1,$2,'alumno','a','b',null,'x@test.cl',null)`, [s1, Z]).then(() => true, () => false)
check('a student request needs a RUT', noRut === false)

check('pending accounts have no access', (await as(db, S2, `select count(*)::int c from public.classes`)).rows[0].c === 0 && (await as(db, M1, `select count(*)::int c from public.students`)).rows[0].c === 0)
check('applicant sees only their own request', (await as(db, S2, `select kind from public.account_requests`)).rows.map((r) => r.kind).join() === 'alumno')
check('CEO sees every pending request', (await as(db, CEO, `select count(*)::int c from public.account_requests where status='pendiente'`)).rows[0].c === 4)
check('school admins do not see requests (CEO only)', (await as(db, A, `select count(*)::int c from public.account_requests`)).rows[0].c === 0)
check('user role sees none', (await as(db, U, `select count(*)::int c from public.account_requests`)).rows[0].c === 0)

const uDec = await tryAs(db, U, `select public.decide_account_request($1, true)`, [r2])
check('user role cannot approve', !uDec.ok, uDec.err)
const aDec = await tryAs(db, A, `select public.decide_account_request($1, true)`, [r2])
check('school admin cannot approve (CEO only)', !aDec.ok, aDec.err)
const xDec = await tryAs(db, X, `select public.decide_account_request($1, true)`, [r2])
check('admin of another school cannot approve', !xDec.ok, xDec.err)

await as(db, CEO, `select public.decide_account_request($1, true, $2)`, [r1, existing])
check('CEO approves a student by linking the existing record', (await db.query(`select user_id from public.students where id=$1`, [existing])).rows[0].user_id === S1)
check('the linked student reaches the portal', (await as(db, S1, `select count(*)::int c from public.students`)).rows[0].c === 1)
const newId = (await as(db, CEO, `select public.decide_account_request($1, true) id`, [r2])).rows[0].id
const ns = (await db.query(`select first_name, rut, user_id from public.students where id=$1`, [newId])).rows[0]
check('CEO approves a student by creating a new record', ns.first_name === 'Nuevo' && ns.rut === '7654321-6' && ns.user_id === S2, ns)
await as(db, CEO, `select public.decide_account_request($1, true, null, 'user')`, [r3])
check('approving a member adds them to the school with the chosen role', (await db.query(`select role from public.school_members where user_id=$1 and school_id=$2`, [M1, s1])).rows[0]?.role === 'user')
check('the approved member now sees school data', (await as(db, M1, `select count(*)::int c from public.students`)).rows[0].c === 2)
await as(db, CEO, `select public.decide_account_request($1, false)`, [r4])
check('rejected request leaves no access', (await as(db, Z, `select count(*)::int c from public.schools`)).rows[0].c === 0)
const again = await tryAs(db, CEO, `select public.decide_account_request($1, true)`, [r4])
check('a decided request cannot be decided again', !again.ok, again.err)

// Students complete their profile
const upd = await tryAs(db, S2, `select public.update_my_student($1,'+56 9 1111 2222','2000-05-10','Calle 1','Mamá','+56 9 3333 4444','Asma')`, [newId])
const me = (await db.query(`select phone, birth_date::text bd, emergency_contact, medical_notes from public.students where id=$1`, [newId])).rows[0]
check('student fills in their own profile', upd.ok && me.phone === '+56 9 1111 2222' && me.bd === '2000-05-10' && me.medical_notes === 'Asma', upd.err ?? me)
const other = await tryAs(db, S2, `select public.update_my_student($1,'x',null,null,null,null,null)`, [existing])
check("student cannot edit someone else's record", !other.ok, other.err)

const direct = await tryAs(db, Z, `select public.register_account_request($1,$2,'alumno','a','b','11111111-1','x@test.cl',null)`, [s1, Z])
check('clients cannot call the registration function directly', !direct.ok, direct.err)
const ins = await tryAs(db, Z, `insert into public.account_requests (school_id, user_id, kind, first_name, first_last_name, email) values ($1,$2,'miembro','a','b','x@test.cl')`, [s1, Z])
check('clients cannot write requests directly', !ins.ok, ins.err)
report()
