// Enrollment fee ("matrícula") per calendar year + CEO shown in member lists.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), A = await newUser(db, 'ana'), U = await newUser(db, 'uri'), X = await newUser(db, 'xavi')
await db.query(`select public.grant_ceo('ceo@test.cl')`)
const s1 = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const s2 = (await as(db, CEO, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user'), ($4,$5,'admin')`, [s1, A, U, s2, X])
const today = (await db.query(`select (now() at time zone 'America/Santiago')::date::text d`)).rows[0].d
const year = Number(today.slice(0, 4))
const fees = (sid) => db.query(`select st.first_name, p.amount, p.concept, p.due_date::text due, p.status from public.payments p join public.students st on st.id = p.student_id where p.kind='matricula' and p.school_id=$1 order by 1, 4`, [sid]).then(r => r.rows)
const asJob = async (sql, params = []) => { await db.query(`select set_config('request.jwt.claims', '{}', false)`); return db.query(sql, params) } // pg_cron: no auth claims

// --- CEO in member lists
const ceos = (await as(db, A, `select * from public.platform_ceos()`)).rows
check('staff see the platform CEO for their member list', ceos.length === 1 && ceos[0].user_id === CEO, ceos)
const S = await newUser(db, 'sofi')
check('a user with no school sees no CEO list', (await as(db, S, `select count(*)::int c from public.platform_ceos()`)).rows[0].c === 0)
check('CEO is not a membership row (never counts as school admin)', (await db.query(`select count(*)::int c from public.school_members where user_id=$1`, [CEO])).rows[0].c === 0)

// --- Fee
await as(db, A, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Antiguo','Uno'), ($1,'Otro','Dos')`, [s1])
await as(db, A, `insert into public.students (school_id, first_name, first_last_name, active) values ($1,'Inactivo','Tres', false)`, [s1])
check('no fee configured → nothing', (await asJob(`select public.generate_enrollment_fees(null, $1::date) n`, [`${year + 1}-01-01`])).rows[0].n === 0)

const uSet = await tryAs(db, U, `update public.schools set enrollment_fee=30000 where id=$1`, [s1])
check('user role cannot set the fee', !uSet.ok || uSet.affected === 0, uSet.err)
await as(db, A, `update public.schools set enrollment_fee=30000 where id=$1`, [s1])
check('turning the fee on stamps the start date', (await db.query(`select enrollment_fee_since::text d from public.schools where id=$1`, [s1])).rows[0].d === today)

await as(db, U, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Nuevo','Cuatro')`, [s1])
check('creating a student does NOT charge a fee', (await fees(s1)).length === 0)
check('turning it on mid-year does not bill the current year', (await as(db, A, `select public.generate_enrollment_fees($1) n`, [s1])).rows[0].n === 0 && (await fees(s1)).length === 0)

const n = (await asJob(`select public.generate_enrollment_fees(null, $1::date) n`, [`${year + 1}-01-01`])).rows[0].n
let f = await fees(s1)
check('Jan 1st: every active student gets "Matrícula <year>"', n === 3 && f.length === 3 && f.every((r) => r.concept === `Matrícula ${year + 1}` && r.due === `${year + 1}-01-01` && r.amount === 30000 && r.status === 'pendiente'), { n, f })
check('inactive students are not charged', f.every((r) => r.first_name !== 'Inactivo'))
check('running again the same year creates nothing', (await asJob(`select public.generate_enrollment_fees(null, $1::date) n`, [`${year + 1}-03-15`])).rows[0].n === 0)

// A student who joins during the year is not charged automatically that year, but is the next one.
await db.query(`insert into public.students (school_id, first_name, first_last_name, created_at) values ($1,'Marzo','Cinco', $2::date)`, [s1, `${year + 1}-03-01`])
check('student who joined mid-year: no automatic charge that year', (await asJob(`select public.generate_enrollment_fees(null, $1::date) n`, [`${year + 1}-06-01`])).rows[0].n === 0)
const n2 = (await asJob(`select public.generate_enrollment_fees(null, $1::date) n`, [`${year + 2}-01-02`])).rows[0].n
check('next year (even a day late) everyone active is charged once', n2 === 4, n2)

// A manual payment for the year counts as paid for that year.
await as(db, A, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Manual','Seis')`, [s1])
const manual = (await db.query(`select id from public.students where first_name='Manual'`)).rows[0].id
await db.query(`update public.students set created_at=$2::date where id=$1`, [manual, `${year + 2}-01-01`])
await as(db, A, `insert into public.payments (school_id, student_id, kind, concept, amount, status, due_date) values ($1,$2,'matricula','Matrícula a mano',30000,'pagado',$3::date)`, [s1, manual, `${year + 2}-02-01`])
check('a manual fee payment for the year prevents a duplicate', (await asJob(`select public.generate_enrollment_fees(null, $1::date) n`, [`${year + 2}-02-02`])).rows[0].n === 0)

const uGen = await tryAs(db, U, `select public.generate_enrollment_fees($1)`, [s1])
check('user role cannot run the generator', !uGen.ok, uGen.err)
const xGen = await tryAs(db, X, `select public.generate_enrollment_fees($1)`, [s1])
check('admin of another school cannot run it', !xGen.ok, xGen.err)
check('an admin cannot fake the date (p_today ignored for users)', (await as(db, A, `select public.generate_enrollment_fees($1, '2099-01-01') n`, [s1])).rows[0].n === 0)
check('school without fee untouched', (await fees(s2)).length === 0)
const dup = await tryAs(db, A, `insert into public.payments (school_id, student_id, kind, concept, amount, due_date) select school_id, student_id, 'matricula', 'x', 1, due_date from public.payments where kind='matricula' and status='pendiente' limit 1`)
check('duplicate charge for the same date rejected', !dup.ok, dup.err)
report()
