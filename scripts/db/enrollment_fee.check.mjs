// Card item 4: school-level enrollment fee with automatic pending charges.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), A = await newUser(db, 'ana'), U = await newUser(db, 'uri'), X = await newUser(db, 'xavi')
await db.query(`select public.grant_ceo('ceo@test.cl')`)
const s1 = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const s2 = (await as(db, CEO, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user'), ($4,$5,'admin')`, [s1, A, U, s2, X])
const today = (await db.query(`select (now() at time zone 'America/Santiago')::date::text d`)).rows[0].d
const fees = (sid) => db.query(`select st.first_name, p.amount, p.due_date::text due, p.status from public.payments p join public.students st on st.id = p.student_id where p.kind='matricula' and p.school_id=$1 order by 1`, [sid]).then(r => r.rows)

// Students that exist before the fee is configured
await as(db, A, `insert into public.students (school_id, first_name, first_last_name, enrollment_date) values ($1,'Antiguo','Uno', $2::date - 400), ($1,'Reciente','Dos', $2::date - 30)`, [s1, today])
check('no fee configured → no charges', (await fees(s1)).length === 0)

const uSet = await tryAs(db, U, `update public.schools set enrollment_fee=30000 where id=$1`, [s1])
check('user role cannot set the fee', !uSet.ok || uSet.affected === 0, uSet.err)
await as(db, A, `update public.schools set enrollment_fee=30000, enrollment_fee_months=12 where id=$1`, [s1])
check('turning the fee on stamps the start date', (await db.query(`select enrollment_fee_since::text d from public.schools where id=$1`, [s1])).rows[0].d === today)

check('admin runs the generator: existing students are not back-billed', (await as(db, A, `select public.generate_enrollment_fees($1) n`, [s1])).rows[0].n === 0)
const uGen = await tryAs(db, U, `select public.generate_enrollment_fees($1)`, [s1])
check('user role cannot run the generator', !uGen.ok, uGen.err)
const xGen = await tryAs(db, X, `select public.generate_enrollment_fees($1)`, [s1])
check('admin of another school cannot run it', !xGen.ok, xGen.err)

await as(db, U, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Nuevo','Tres')`, [s1])
let f = await fees(s1)
check('new student gets a pending enrollment fee right away', f.length === 1 && f[0].first_name === 'Nuevo' && f[0].amount === 30000 && f[0].status === 'pendiente' && f[0].due === today, f)
check('generator is idempotent', (await as(db, A, `select public.generate_enrollment_fees($1) n`, [s1])).rows[0].n === 0)

// Period expired: pretend the fee was configured long ago and the last charge was 13 months back.
await db.query(`update public.schools set enrollment_fee_since = $2::date - 800 where id=$1`, [s1, today])
await db.query(`update public.payments set due_date = $1::date - 395, status='pagado' where kind='matricula'`, [today])
const asJob = async (sql) => { await db.query(`select set_config('request.jwt.claims', '{}', false)`); return db.query(sql) } // pg_cron: no auth claims
const n = (await asJob(`select public.generate_enrollment_fees() n`)).rows[0].n
f = await fees(s1)
check('daily job charges expired periods and anniversaries (one per student, no backlog)', n === 3 && f.length === 4, { n, f })
check('second run creates nothing', (await asJob(`select public.generate_enrollment_fees() n`)).rows[0].n === 0)
check('school without fee untouched', (await fees(s2)).length === 0)
const dup = await tryAs(db, A, `insert into public.payments (school_id, student_id, kind, concept, amount, due_date) select school_id, student_id, 'matricula', 'x', 1, due_date from public.payments where kind='matricula' and status='pendiente' limit 1`)
check('duplicate charge for the same period rejected', !dup.ok, dup.err)
await as(db, A, `update public.schools set enrollment_fee=0 where id=$1`, [s1])
await as(db, A, `insert into public.students (school_id, first_name, first_last_name) values ($1,'SinCobro','Cuatro')`, [s1])
check('fee turned off → new students not charged', (await fees(s1)).every((r) => r.first_name !== 'SinCobro'))
const direct = await tryAs(db, A, `select public.enrollment_fee_due(id) from public.students limit 1`)
check('internal due-date helper not callable by clients', !direct.ok, direct.err)
report()
