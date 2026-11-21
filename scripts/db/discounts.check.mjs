// Discount codes: admins create them; a student redeems on a pending payment ('pago' = one payment, 'plan' =
// permanent on the enrollment); uses/stock, dates, plan limits, one use per student, guards and rate limit.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const OWNER = await newUser(db, 'owner'), ADM = await newUser(db, 'adm'), USR = await newUser(db, 'usr')
const ANA = await newUser(db, 'ana'), BETO = await newUser(db, 'beto'), CATA = await newUser(db, 'cata'), MOM = await newUser(db, 'mama')
await db.query(`insert into public.owners (user_id) values ($1)`, [OWNER])
const sc = (await as(db, OWNER, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const sc2 = (await as(db, OWNER, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user')`, [sc, ADM, USR])
const stu = async (u, n, rut) => (await as(db, OWNER, `insert into public.students (school_id, first_name, first_last_name, rut, user_id) values ($1,$2,'X',$3,$4) returning id`, [sc, n, rut, u])).rows[0].id
const ana = await stu(ANA, 'Ana', '11111111-1'), beto = await stu(BETO, 'Beto', '22222222-2'), cata = await stu(CATA, 'Cata', '33333333-3')
const mom = await stu(MOM, 'Carla', '44444444-4')
const kid = await stu(null, 'Tomás', '55555555-5')
await db.query(`insert into public.student_guardians (guardian_id, student_id, school_id) values ($1,$2,$3)`, [MOM, kid, sc])
const plan = (await as(db, OWNER, `insert into public.plans (school_id, name, price) values ($1,'Mensual',30000) returning id`, [sc])).rows[0].id
const plan2 = (await as(db, OWNER, `insert into public.plans (school_id, name, price) values ($1,'Kids',20000) returning id`, [sc])).rows[0].id
const enroll = async (s, p = plan, price = 30000) => (await as(db, OWNER, `insert into public.enrollments (school_id, student_id, plan_id, price) values ($1,$2,$3,$4) returning id`, [sc, s, p, price])).rows[0].id
const pay = async (s, amount, enr = null, kind = enr ? 'plan' : 'otro') => (await as(db, OWNER,
  `insert into public.payments (school_id, student_id, enrollment_id, kind, concept, amount) values ($1,$2,$3,$4,'Cobro',$5) returning id`, [sc, s, enr, kind, amount])).rows[0].id
const payRow = async (id) => (await db.query(`select amount, discount_amount, discount_code, status, paid_at from public.payments where id=$1`, [id])).rows[0]
const redeem = (u, p, code) => as(db, u, `select public.redeem_discount($1,$2) r`, [p, code]).then((x) => x.rows[0].r)

// Codes: only admins
const mk = (u, cols, vals) => tryAs(db, u, `insert into public.discount_codes (school_id, ${cols}) values ($1, ${vals.map((_, i) => '$' + (i + 2)).join(',')}) returning id`, [sc, ...vals])
check('a "usuario" member cannot create codes', !(await mk(USR, 'code, percent', ['NOPE10', 10])).ok)
check('a student cannot create codes', !(await mk(ANA, 'code, percent', ['NOPE10', 10])).ok)
const c1 = await mk(ADM, 'code, percent, max_uses', ['VERANO20', 20, 2])
check('admin creates a 20 % code with 2 uses', c1.ok, c1.err)
check('percent and amount cannot both be set', !(await mk(ADM, 'code, percent, amount', ['DOBLE', 10, 1000])).ok)
check('lowercase / bad code is rejected', !(await mk(ADM, 'code, percent', ['ab', 10])).ok)
check('duplicate code is rejected', !(await mk(ADM, 'code, percent', ['VERANO20', 5])).ok)
const fixed = (await mk(ADM, 'code, amount, max_uses', ['UNICO5000', 5000, 1])).rows[0].id
const perm = (await mk(ADM, 'code, percent, scope', ['FAMILIA', 10, 'plan'])).rows[0].id
await mk(ADM, 'code, percent, plan_id', ['SOLOKIDS', 50, plan2])
await mk(ADM, 'code, percent, valid_until', ['VIEJO', 10, '2020-01-01'])
await mk(ADM, 'code, percent, valid_from', ['FUTURO', 10, '2099-01-01'])
await mk(ADM, 'code, percent', ['GRATIS', 100])
await db.query(`insert into public.discount_codes (school_id, code, percent) values ($1,'OTRAESCUELA',50)`, [sc2])
check('students cannot read codes', (await as(db, ANA, `select count(*)::int c from public.discount_codes`)).rows[0].c === 0)
check('"usuario" members cannot read codes', (await as(db, USR, `select count(*)::int c from public.discount_codes`)).rows[0].c === 0)
check('admins read codes', (await as(db, ADM, `select count(*)::int c from public.discount_codes`)).rows[0].c === 7)

// 'pago' code on one payment
const p1 = await pay(ana, 30000)
check('another student cannot redeem on my payment', !(await tryAs(db, BETO, `select public.redeem_discount($1,'VERANO20')`, [p1])).ok)
check('wrong code → invalid', (await redeem(ANA, p1, 'NOEXISTE')).error === 'invalid')
check('code of another school → invalid', (await redeem(ANA, p1, 'OTRAESCUELA')).error === 'invalid')
check('expired code', (await redeem(ANA, p1, 'VIEJO')).error === 'expired')
check('not yet valid', (await redeem(ANA, p1, 'futuro')).error === 'not_yet')
check('plan-limited code on another payment', (await redeem(ANA, p1, 'SOLOKIDS')).error === 'plan')
check('permanent code needs a plan payment', (await redeem(ANA, p1, 'FAMILIA')).error === 'plan_only')
const r1 = await redeem(ANA, p1, ' verano20 ')
check('student redeems (case/spaces ignored)', r1.ok && r1.discount === 6000 && r1.amount === 24000, JSON.stringify(r1))
{ const x = await payRow(p1); check('payment amount 24.000, discount 6.000 snapshotted', x.amount === 24000 && x.discount_amount === 6000 && x.discount_code === 'VERANO20', x) }
check('a payment takes only one discount', (await redeem(ANA, p1, 'UNICO5000')).error === 'has_discount')
check('same student cannot reuse a code', (await redeem(ANA, await pay(ana, 10000), 'VERANO20')).error === 'used')
check('second use by another student', (await redeem(BETO, await pay(beto, 10000), 'VERANO20')).ok)
check('stock exhausted after 2 uses', (await redeem(CATA, await pay(cata, 10000), 'VERANO20')).error === 'exhausted')
check('max uses cannot go below uses made', !(await tryAs(db, ADM, `update public.discount_codes set max_uses=1 where code='VERANO20'`)).ok)
check('more stock can be added', (await tryAs(db, ADM, `update public.discount_codes set max_uses=3 where code='VERANO20'`)).ok)
check('fixed amount code', (await redeem(CATA, await pay(cata, 3000), 'UNICO5000')).discount === 3000)
check('a fixed amount never exceeds the payment (→ $0, paid)', (await db.query(`select amount, status::text, paid_at is not null pa from public.payments where discount_code='UNICO5000'`)).rows[0]?.status === 'pagado')
{ const g = await pay(beto, 15000); const r = await redeem(BETO, g, 'GRATIS'); const x = await payRow(g)
  check('100 % code → $0 and paid', r.ok && x.amount === 0 && x.status === 'pagado' && x.paid_at, x) }

// Guards: nobody writes the discount columns directly
check('student cannot write discount columns', !(await tryAs(db, ANA, `update public.payments set discount_amount = 1000 where id=$1`, [p1])).ok || (await payRow(p1)).discount_amount === 6000)
check('admin cannot either (only via code)', !(await tryAs(db, ADM, `update public.payments set discount_amount = 0 where id=$1`, [p1])).ok)
check('fabricated discount on insert is ignored', await (async () => { const r = await as(db, ADM, `insert into public.payments (school_id, student_id, concept, amount, discount_amount, discount_code) values ($1,$2,'x',1000,999,'FAKE') returning discount_amount, discount_code`, [sc, ana]); return r.rows[0].discount_amount === 0 && r.rows[0].discount_code === null })())
check('enrollment discount cannot be set directly', !(await tryAs(db, ADM, `update public.enrollments set discount_percent = 50 where id=$1`, [await enroll(beto, plan2, 20000)])).ok)

// In review: no discount after reporting the transfer
await as(db, OWNER, `update public.schools set transfer_account_number='123' where id=$1`, [sc])
{ const p = await pay(cata, 10000); await as(db, CATA, `select public.submit_payment($1,'transferencia')`, [p])
  check('payment in review cannot take a code', (await redeem(CATA, p, 'FAMILIA')).error === 'in_review') }

// 'plan' code: permanent on the enrollment
const eAna = await enroll(ana)
const pa1 = await pay(ana, 30000, eAna)
const rp = await redeem(ANA, pa1, 'FAMILIA')
check('permanent code on a plan payment', rp.ok && rp.discount === 3000 && rp.scope === 'plan', JSON.stringify(rp))
check('enrollment carries the discount', (await db.query(`select discount_code, discount_percent from public.enrollments where id=$1`, [eAna])).rows[0].discount_percent === 10)
const pa2 = await pay(ana, 30000, eAna)
{ const x = await payRow(pa2); check('next plan payment is discounted automatically', x.amount === 27000 && x.discount_code === 'FAMILIA', x) }
check('a permanent use counts once', (await as(db, ADM, `select uses from public.discount_code_uses($1) where code_id=$2`, [sc, perm])).rows[0].uses === 1)
check('admin sees uses and savings', (await as(db, ADM, `select saved::int s from public.discount_code_uses($1) where code_id=$2`, [sc, perm])).rows[0].s === 3000)
check('students cannot see uses', (await as(db, ANA, `select count(*)::int c from public.discount_code_uses($1)`, [sc])).rows[0].c === 0)
check('plan-limited code works on its plan', await (async () => { const e = await enroll(cata, plan2, 20000); return (await redeem(CATA, await pay(cata, 20000, e), 'SOLOKIDS')).discount === 10000 })())

// Staff apply a permanent code to an enrollment
const eBeto = await enroll(beto)
const pb = await pay(beto, 30000, eBeto)
check('a "pago" code cannot go on an enrollment', (await as(db, USR, `select public.redeem_discount_enrollment($1,'VERANO20') r`, [eBeto])).rows[0].r.error !== undefined)
const re = (await as(db, USR, `select public.redeem_discount_enrollment($1,'FAMILIA') r`, [eBeto])).rows[0].r
check('front desk applies a permanent code to an enrollment', re.ok, JSON.stringify(re))
check('its pending plan payment was discounted', (await payRow(pb)).amount === 27000)
check('students cannot use the enrollment entry point', !(await tryAs(db, BETO, `select public.redeem_discount_enrollment($1,'FAMILIA')`, [eBeto])).ok)

// Guardian redeems for the child
{ const p = await pay(kid, 20000); const r = await redeem(MOM, p, 'VERANO20'); check('guardian redeems on the child payment', r.ok && r.discount === 4000, JSON.stringify(r)) }

// Removing
check('"usuario" cannot remove a discount', !(await tryAs(db, USR, `select public.remove_discount($1)`, [p1])).ok)
check('student cannot remove a discount', !(await tryAs(db, ANA, `select public.remove_discount($1)`, [p1])).ok)
await as(db, ADM, `select public.remove_discount($1)`, [p1])
{ const x = await payRow(p1); check('admin removes it: amount restored', x.amount === 30000 && x.discount_amount === 0 && x.discount_code === null, x) }
check('the use is freed', (await db.query(`select count(*)::int c from public.discount_redemptions where payment_id=$1`, [p1])).rows[0].c === 0)
await as(db, ADM, `select public.remove_enrollment_discount($1)`, [eAna])
{ const x = await payRow(await pay(ana, 30000, eAna)); check('after removing the permanent discount new payments are full price', x.amount === 30000 && x.discount_amount === 0, x) }
check('codes with uses cannot be deleted (deactivate instead)', !(await tryAs(db, ADM, `delete from public.discount_codes where code='VERANO20'`)).ok)
check('unused codes can be deleted', (await tryAs(db, ADM, `delete from public.discount_codes where code='VIEJO'`)).ok)
check('audit log has redemptions', (await db.query(`select count(*)::int c from public.audit_log where action='discount_redeemed'`)).rows[0].c >= 5)

// Rate limit: 10 tries per hour per user
{ let last; for (let i = 0; i < 12; i++) last = await redeem(CATA, await pay(cata, 1000), 'NADA' + i)
  check('11th try in an hour is refused', last.error === 'too_many', JSON.stringify(last)) }
check('anon cannot redeem', !(await tryAs(db, null, `select public.redeem_discount($1,'X')`, [p1])).ok)
report()
