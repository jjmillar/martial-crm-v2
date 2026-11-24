// Students contract a plan: enrollment 'pendiente' + pending payment → paid (approved or marked) → active.
// Renewal near the end, free plans, withdraw, and that nobody can contract for someone else.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const OWNER = await newUser(db, 'owner'), ADM = await newUser(db, 'adm'), S1 = await newUser(db, 'cami'), S2 = await newUser(db, 'pedro'), STRANGER = await newUser(db, 'x')
await db.query(`insert into public.owners (user_id) values ($1)`, [OWNER])
const sc = (await as(db, OWNER, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const sc2 = (await as(db, OWNER, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin')`, [sc, ADM])
await as(db, OWNER, `update public.schools set transfer_bank='Banco Estado', transfer_account_type='Cuenta RUT', transfer_account_number='11111111', transfer_holder='Dojo Uno SpA', transfer_rut='76.111.111-1' where id=$1`, [sc])
const mk = async (user, first, rut) => (await as(db, OWNER, `insert into public.students (school_id, first_name, first_last_name, rut, user_id) values ($1,$2,'X',$3,$4) returning id`, [sc, first, rut, user])).rows[0].id
const st1 = await mk(S1, 'Camila', '11111111-1'), st2 = await mk(S2, 'Pedro', '7654321-6')
const plan = async (school, name, price, extra = {}) => (await as(db, OWNER,
  `insert into public.plans (school_id, name, price, duration_days, is_trial, active) values ($1,$2,$3,$4,$5,$6) returning id`,
  [school, name, price, extra.days === undefined ? 30 : extra.days, extra.trial ?? false, extra.active ?? true])).rows[0].id
const mensual = await plan(sc, 'Mensual', 35000), libre = await plan(sc, 'Libre', 0), prueba = await plan(sc, 'Prueba', 0, { trial: true })
const viejo = await plan(sc, 'Viejo', 20000, { active: false }), ajeno = await plan(sc2, 'Ajeno', 10000), anual = await plan(sc, 'Anual', 300000, { days: 365 })
const contract = (user, sid, pid) => as(db, user, `select public.contract_plan($1,$2) r`, [sid, pid]).then((x) => x.rows[0].r)

check('cannot contract for another student', (await contract(S2, st1, mensual)).error === 'not_allowed')
check('a stranger cannot contract', (await contract(STRANGER, st1, mensual)).error === 'not_allowed')
check('anon cannot call it', !(await tryAs(db, null, `select public.contract_plan($1,$2)`, [st1, mensual])).ok)
check('inactive plan is not available', (await contract(S1, st1, viejo)).error === 'plan_unavailable')
check('trial plan is not available', (await contract(S1, st1, prueba)).error === 'plan_unavailable')
check("another school's plan is not available", (await contract(S1, st1, ajeno)).error === 'plan_unavailable')

const r1 = await contract(S1, st1, mensual)
check('contract → enrollment + payment', r1.enrollment_id && r1.payment_id && r1.kind === 'nuevo', r1)
const e1 = (await db.query(`select status, price, ends_at from public.enrollments where id=$1`, [r1.enrollment_id])).rows[0]
check('enrollment waits as pendiente with the plan price', e1.status === 'pendiente' && e1.price === 35000 && e1.ends_at === null, e1)
const p1 = (await db.query(`select status, amount, kind, enrollment_id, concept from public.payments where id=$1`, [r1.payment_id])).rows[0]
check('pending plan payment for the plan price', p1.status === 'pendiente' && p1.amount === 35000 && p1.kind === 'plan' && p1.concept === 'Plan Mensual', p1)
check('student sees the payment and the enrollment', (await as(db, S1, `select count(*)::int c from public.payments where id=$1`, [r1.payment_id])).rows[0].c === 1
  && (await as(db, S1, `select count(*)::int c from public.enrollments where id=$1`, [r1.enrollment_id])).rows[0].c === 1)
const again = await contract(S1, st1, mensual)
check('asking again returns the same waiting payment', again.payment_id === r1.payment_id && again.enrollment_id === r1.enrollment_id, again)

// Pay: student reports, admin approves → active from today for 30 days.
const sub = (await as(db, S1, `select public.submit_payment($1,'transferencia') id`, [r1.payment_id])).rows[0].id
check('cannot withdraw once reported', (await as(db, S1, `select public.withdraw_plan_contract($1,$2) r`, [st1, r1.enrollment_id])).rows[0].r.error === 'reported')
await as(db, ADM, `select public.decide_payment_submission($1, true)`, [sub])
const e1b = (await db.query(`select status, start_date = (now() at time zone 'America/Santiago')::date today, ends_at - start_date days from public.enrollments where id=$1`, [r1.enrollment_id])).rows[0]
check('approved payment activates the enrollment from today for the plan duration', e1b.status === 'activa' && e1b.today && e1b.days === 30, e1b)
check('own active plan, far from its end → nothing to buy', (await contract(S1, st1, mensual)).error === 'already_active')

// Renewal: near the end → pending renewal payment; paid directly by staff → extended by 30 days.
await db.query(`update public.enrollments set ends_at = (now() at time zone 'America/Santiago')::date + 3 where id=$1`, [r1.enrollment_id])
const ren = await contract(S1, st1, mensual)
check('near the end → renewal payment', ren.kind === 'renovacion' && ren.payment_id && ren.enrollment_id === r1.enrollment_id, ren)
check('renewal is idempotent too', (await contract(S1, st1, mensual)).payment_id === ren.payment_id)
await as(db, ADM, `update public.payments set status='pagado', method='efectivo' where id=$1`, [ren.payment_id])
const e1c = (await db.query(`select ends_at - (now() at time zone 'America/Santiago')::date left_days from public.enrollments where id=$1`, [r1.enrollment_id])).rows[0]
check('renewal marked paid by staff → extended from the old end', e1c.left_days === 33, e1c)

// Expired → renewal counts from today.
await db.query(`update public.enrollments set start_date = (now() at time zone 'America/Santiago')::date - 40, ends_at = (now() at time zone 'America/Santiago')::date - 10 where id=$1`, [r1.enrollment_id])
const ren2 = await contract(S1, st1, mensual)
await as(db, ADM, `update public.payments set status='pagado' where id=$1`, [ren2.payment_id])
check('expired plan renewed → 30 days from today', (await db.query(`select ends_at - (now() at time zone 'America/Santiago')::date d from public.enrollments where id=$1`, [r1.enrollment_id])).rows[0].d === 30)

// Free plan activates at once; no payment.
const free = await contract(S1, st1, libre)
check('free plan activates at once without a payment', free.active === true && !free.payment_id
  && (await db.query(`select status from public.enrollments where id=$1`, [free.enrollment_id])).rows[0].status === 'activa', free)

// Withdraw a contract that is unpaid and unreported.
const r2 = await contract(S2, st2, anual)
check('someone else cannot withdraw it', (await as(db, S1, `select public.withdraw_plan_contract($1,$2) r`, [st2, r2.enrollment_id])).rows[0].r.error === 'not_allowed')
const w = (await as(db, S2, `select public.withdraw_plan_contract($1,$2) r`, [st2, r2.enrollment_id])).rows[0].r
check('student withdraws an unpaid contract', w.ok === true
  && (await db.query(`select count(*)::int c from public.enrollments where id=$1`, [r2.enrollment_id])).rows[0].c === 0
  && (await db.query(`select count(*)::int c from public.payments where id=$1`, [r2.payment_id])).rows[0].c === 0, w)

// Staff enrolled them by hand meanwhile: paying the pending contract renews that one instead.
const r3 = await contract(S2, st2, anual)
const manual = (await as(db, ADM, `insert into public.enrollments (school_id, student_id, plan_id, price, ends_at) values ($1,$2,$3,300000,(now() at time zone 'America/Santiago')::date + 5) returning id`, [sc, st2, anual])).rows[0].id
await as(db, ADM, `update public.payments set status='pagado' where id=$1`, [r3.payment_id])
const m = (await db.query(`select ends_at - (now() at time zone 'America/Santiago')::date d from public.enrollments where id=$1`, [manual])).rows[0]
check('paid contract with a manual enrollment already active → extends it, no duplicate', m.d === 370
  && (await db.query(`select count(*)::int c from public.enrollments where student_id=$1 and plan_id=$2`, [st2, anual])).rows[0].c === 1
  && (await db.query(`select enrollment_id from public.payments where id=$1`, [r3.payment_id])).rows[0].enrollment_id === manual, m)

check('students cannot write enrollments directly', (await tryAs(db, S1, `insert into public.enrollments (school_id, student_id, plan_id, price) values ($1,$2,$3,1)`, [sc, st1, anual])).ok === false)
check('trigger function is not callable', !(await tryAs(db, S1, `select public.payments_activate_enrollment()`)).ok)
report()
