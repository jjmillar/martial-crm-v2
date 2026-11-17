// Platform console ("el CRM del CRM"): one operator account, MFA mandatory, sees customers and their subscriptions
// but no school data; suspending a customer closes their schools for owner, team and students.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const AAL2 = { aal: 'aal2' }
const OP = await newUser(db, 'operador'), OWNER = await newUser(db, 'owner'), ADM = await newUser(db, 'adm'), STU = await newUser(db, 'cami'), OTHER = await newUser(db, 'otro')
await db.query(`insert into public.platform_operators (user_id, username) values ($1, 'martialroot')`, [OP])
check('no platform-wide CEO is left', (await db.query(`select count(*)::int c from public.platform_admins`)).rows[0].c === 0)

await db.query(`insert into public.owners (user_id) values ($1), ($2)`, [OWNER, OTHER])
const sub = (await db.query(`select status, trial_ends, plan_id from public.subscriptions where owner_id=$1`, [OWNER])).rows[0]
check('a new customer starts a 14-day trial on a paid plan', sub?.status === 'prueba' && sub.trial_ends && sub.plan_id, sub)
const sc = (await as(db, OWNER, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin')`, [sc, ADM])
await as(db, OWNER, `insert into public.students (school_id, first_name, first_last_name, rut, user_id) values ($1,'Camila','Medel','11111111-1',$2)`, [sc, STU])

// whoami
const who = (await as(db, OP, `select public.platform_whoami() w`)).rows[0].w
check('whoami: operator, not verified yet with aal1', who.operator === true && who.verified === false && who.username === 'martialroot', who)
check('whoami: an owner is not the operator', (await as(db, OWNER, `select public.platform_whoami() w`)).rows[0].w.operator === false)

// MFA mandatory
const noMfa = await tryAs(db, OP, `select * from public.platform_customers()`)
check('operator without two-step verification gets nothing', !noMfa.ok && /not allowed/.test(noMfa.err), noMfa.err)
const custs = await tryAs(db, OP, `select * from public.platform_customers()`, [], AAL2)
const mine = custs.rows?.find((r) => r.owner_id === OWNER)
check('operator (aal2) lists customers with schools and student counts', custs.ok && custs.rows.length === 2 && mine?.students === 1 && mine.schools[0].slug === 'dojo-uno', custs.err ?? mine)
check('an owner cannot list customers', !(await tryAs(db, OWNER, `select * from public.platform_customers()`, [], AAL2)).ok)
check('a school admin cannot list customers', !(await tryAs(db, ADM, `select * from public.platform_customers()`, [], AAL2)).ok)

// Least privilege: no school data for the operator
check('operator reads no students', (await as(db, OP, `select count(*)::int c from public.students`, [], AAL2)).rows[0].c === 0)
check('operator reads no schools directly', (await as(db, OP, `select count(*)::int c from public.schools`, [], AAL2)).rows[0].c === 0)
check('operator is not a school member', (await as(db, OP, `select public.is_school_member($1) m`, [sc], AAL2)).rows[0].m === false)

// Plans
const plan = await tryAs(db, OP, `insert into public.platform_plans (name, price_clp, period) values ('Pro', 49990, 'mensual') returning id`, [], AAL2)
check('operator creates a plan', plan.ok, plan.err)
check('operator without aal2 cannot create plans', !(await tryAs(db, OP, `insert into public.platform_plans (name) values ('X')`)).ok)
check('owner cannot create plans', !(await tryAs(db, OWNER, `insert into public.platform_plans (name) values ('X')`, [], AAL2)).ok)
check('owner sees no plan catalogue', (await as(db, OWNER, `select count(*)::int c from public.platform_plans`, [], AAL2)).rows[0].c === 0)
const pro = plan.rows[0].id

// Subscriptions
check('owner sees own subscription only', (await as(db, OWNER, `select count(*)::int c from public.subscriptions`)).rows[0].c === 1)
check('owner cannot change their subscription', (await tryAs(db, OWNER, `update public.subscriptions set status='activa' where owner_id=$1`, [OWNER])).affected !== 1)
const upd = (status) => tryAs(db, OP, `select public.platform_update_subscription($1,$2,$3,null,'2026-12-31','pagó por transferencia')`, [OWNER, pro, status], AAL2)
check('owner cannot call the operator update', !(await tryAs(db, OWNER, `select public.platform_update_subscription($1,null,'activa',null,null,null)`, [OWNER], AAL2)).ok)
const a = await upd('activa')
const s2 = (await db.query(`select status, plan_id, period_end::text pe, updated_by from public.subscriptions where owner_id=$1`, [OWNER])).rows[0]
check('operator activates a subscription', a.ok && s2.status === 'activa' && s2.plan_id === pro && s2.pe === '2026-12-31' && s2.updated_by === OP, a.err ?? s2)
const ev = await as(db, OP, `select * from public.platform_events(10)`, [], AAL2)
check('each change is recorded with what changed', ev.rows.length === 1 && ev.rows[0].details.status?.[1] === 'activa' && ev.rows[0].details.plan, ev.rows)
await upd('activa')
check('saving with no changes records nothing', (await as(db, OP, `select count(*)::int c from public.platform_events(10)`, [], AAL2)).rows[0].c === 1)
check('owner cannot read the history', !(await tryAs(db, OWNER, `select * from public.platform_events(10)`, [], AAL2)).ok)

// Suspension closes the school
const before = (await as(db, ADM, `select count(*)::int c from public.students`)).rows[0].c
await upd('suspendida')
check('suspended: owner is no longer an owner and cannot create schools', (await as(db, OWNER, `select public.is_owner() o`)).rows[0].o === false && !(await tryAs(db, OWNER, `select public.create_school('Otra','otra-escuela')`)).ok)
check('suspended: owner loses the school', (await as(db, OWNER, `select count(*)::int c from public.schools`)).rows[0].c === 0)
check('suspended: team loses the data', before === 1 && (await as(db, ADM, `select count(*)::int c from public.students`)).rows[0].c === 0)
check('suspended: student loses access', (await as(db, STU, `select count(*)::int c from public.students`)).rows[0].c === 0)
check('suspended: team cannot write', !(await tryAs(db, ADM, `insert into public.students (school_id, first_name, first_last_name, rut) values ($1,'X','Y','7654321-6')`, [sc])).ok)
const bl = (await as(db, STU, `select * from public.my_blocked_schools()`)).rows
check('suspended: each account learns which school is closed', bl.length === 1 && bl[0].name === 'Dojo Uno' && (await as(db, ADM, `select count(*)::int c from public.my_blocked_schools()`)).rows[0].c === 1)
check('other customers are not affected', (await as(db, OTHER, `select count(*)::int c from public.my_blocked_schools()`)).rows[0].c === 0)
await upd('activa')
check('reactivated: access comes back', (await as(db, ADM, `select count(*)::int c from public.students`)).rows[0].c === 1 && (await as(db, STU, `select count(*)::int c from public.my_blocked_schools()`)).rows[0].c === 0)

// Grants
const anonFn = await tryAs(db, null, `select public.platform_whoami()`)
check('anon cannot call platform functions', !anonFn.ok)
check('nobody can make themselves operator', !(await tryAs(db, OWNER, `insert into public.platform_operators (user_id, username) values ($1,'yo-mismo')`, [OWNER], AAL2)).ok)
report()
