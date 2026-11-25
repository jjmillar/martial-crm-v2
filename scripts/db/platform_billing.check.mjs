// Paying Martial CRM: the customer (owner) opens a charge for a plan, applies the operator's discount codes, reports
// the transfer; the operator confirms it and the subscription is active until the period end. Customers never read
// codes, other customers' charges or the plan table; the operator needs aal2.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const AAL2 = { aal: 'aal2' }
const OP = await newUser(db, 'operador'), OWNER = await newUser(db, 'owner'), OTHER = await newUser(db, 'otro'), ADM = await newUser(db, 'adm')
await db.query(`insert into public.platform_operators (user_id, username) values ($1, 'martialroot')`, [OP])
await db.query(`insert into public.owners (user_id) values ($1), ($2)`, [OWNER, OTHER])
const sc = (await as(db, OWNER, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin')`, [sc, ADM])
const today = (await db.query(`select (now() at time zone 'America/Santiago')::date::text d`)).rows[0].d

// Plan and trial
const mensual = (await db.query(`select id, price_clp, period from public.platform_plans where name = 'Mensual'`)).rows[0]
check('a $20.000 monthly plan exists', mensual?.price_clp === 20000 && mensual.period === 'mensual', mensual)
const trial = (await db.query(`select status, plan_id from public.subscriptions where owner_id=$1`, [OWNER])).rows[0]
check('new customers try the cheapest paid plan (the $20.000 one)', trial.status === 'prueba' && trial.plan_id === mensual.id, trial)

// my_subscription
const me = await tryAs(db, OWNER, `select public.my_subscription() s`)
const s = me.rows?.[0].s
check('owner reads their subscription', me.ok && s.status === 'prueba' && s.plan.name === 'Mensual' && s.usage.schools === 1, me.err ?? s)
check('the plans to choose from are listed for the owner', s?.plans.some((p) => p.name === 'Mensual') && s.plans.every((p) => p.price_clp > 0))
check('no transfer data until the platform sets it', s?.transfer === null)
check('a school admin is not a customer', !(await tryAs(db, ADM, `select public.my_subscription()`)).ok)
check('anon cannot read it', !(await tryAs(db, null, `select public.my_subscription()`)).ok)
check('owner still cannot read the plan table', (await as(db, OWNER, `select count(*)::int c from public.platform_plans`)).rows[0].c === 0)

// Transfer data: operator only
check('owner cannot read the platform settings table', (await as(db, OWNER, `select count(*)::int c from public.platform_settings`)).rows[0].c === 0)
check('owner cannot change the transfer data', (await tryAs(db, OWNER, `update public.platform_settings set transfer_account_number='1'`)).affected !== 1)
check('operator without aal2 cannot change it', (await tryAs(db, OP, `update public.platform_settings set transfer_account_number='1'`)).affected !== 1)
const setT = await tryAs(db, OP, `update public.platform_settings set transfer_bank='Banco Estado', transfer_account_number='123456', transfer_holder='Martial CRM SpA', transfer_rut='76.123.456-7', transfer_email='pagos@example.com'`, [], AAL2)
check('operator sets the transfer data', setT.ok && setT.affected === 1, setT.err)
check('owner now sees the transfer data', (await as(db, OWNER, `select public.my_subscription() s`)).rows[0].s.transfer?.account_number === '123456')

// Checkout
const co = await tryAs(db, OWNER, `select public.subscription_checkout($1) id`, [mensual.id])
const inv = co.ok && (await db.query(`select * from public.platform_invoices where id=$1`, [co.rows[0].id])).rows[0]
check('owner opens a charge for the plan', co.ok && inv.amount === 20000 && inv.status === 'pendiente' && inv.period_start.toISOString().slice(0, 10) === today, co.err ?? inv)
check('the same plan again returns the same charge', (await as(db, OWNER, `select public.subscription_checkout($1) id`, [mensual.id])).rows[0].id === inv.id)
check('owner cannot write charges directly', !(await tryAs(db, OWNER, `insert into public.platform_invoices (owner_id, plan_name, period, period_start, period_end, base_amount, amount) values ($1,'x','mensual',now(),now(),1,1)`, [OWNER])).ok)
check('owner cannot mark their charge paid', (await tryAs(db, OWNER, `update public.platform_invoices set status='pagada' where id=$1`, [inv.id])).affected !== 1)
check('another customer does not see it', (await as(db, OTHER, `select count(*)::int c from public.platform_invoices`)).rows[0].c === 0)
const inactive = (await db.query(`insert into public.platform_plans (name, price_clp, active) values ('Viejo', 5000, false) returning id`)).rows[0].id
check('an inactive plan cannot be bought', !(await tryAs(db, OWNER, `select public.subscription_checkout($1)`, [inactive])).ok)
const free = (await db.query(`select id from public.platform_plans where price_clp = 0 limit 1`)).rows[0].id
check('a free plan cannot be bought', !(await tryAs(db, OWNER, `select public.subscription_checkout($1)`, [free])).ok)

// Discount codes: operator only
check('owner cannot create codes', !(await tryAs(db, OWNER, `insert into public.platform_discount_codes (code, percent) values ('GRATIS', 100)`, [], AAL2)).ok)
check('operator without aal2 cannot create codes', !(await tryAs(db, OP, `insert into public.platform_discount_codes (code, percent) values ('X10', 10)`)).ok)
const mk = (code, extra = '') => tryAs(db, OP, `insert into public.platform_discount_codes (code, ${extra ? extra.split('=')[0] : 'percent'}) values ($1, ${extra ? extra.split('=')[1] : 25}) returning id`, [code], AAL2)
const c1 = await mk('BIENVENIDA')
check('operator creates a code', c1.ok, c1.err)
await mk('PERMA', 'percent=50'); await db.query(`update public.platform_discount_codes set scope='plan' where code='PERMA'`)
await mk('UNO', 'amount=5000'); await db.query(`update public.platform_discount_codes set max_uses=1 where code='UNO'`)
await mk('OTROPLAN'); await db.query(`update public.platform_discount_codes set plan_id=$1 where code='OTROPLAN'`, [inactive])
check('owner cannot read the codes (no enumeration)', (await as(db, OWNER, `select count(*)::int c from public.platform_discount_codes`)).rows[0].c === 0)

const apply = async (who, code) => (await as(db, who, `select public.subscription_apply_code($1) r`, [code])).rows[0].r
check('unknown code is rejected', (await apply(OWNER, 'NOEXISTE')).error === 'invalid')
check('code for another plan is rejected', (await apply(OWNER, 'OTROPLAN')).error === 'plan')
const ok1 = await apply(OWNER, ' bienvenida ')
const inv2 = (await db.query(`select amount, discount_amount, discount_code from public.platform_invoices where id=$1`, [inv.id])).rows[0]
check('a 25 % code discounts the charge', ok1.ok && inv2.amount === 15000 && inv2.discount_amount === 5000 && inv2.discount_code === 'BIENVENIDA', [ok1, inv2])
check('one code per charge', (await apply(OWNER, 'UNO')).error === 'has_discount')

// Report and decide
check('a school admin cannot report for the owner', !(await tryAs(db, ADM, `select public.subscription_report_transfer('x')`)).ok)
const rep = await tryAs(db, OWNER, `select public.subscription_report_transfer('Transferencia 0042')`)
const inv3 = (await db.query(`select status, reference from public.platform_invoices where id=$1`, [inv.id])).rows[0]
check('owner reports the transfer', rep.ok && inv3.status === 'por_confirmar' && inv3.reference === 'Transferencia 0042', rep.err ?? inv3)
check('no code or plan change while it is being checked', (await apply(OWNER, 'UNO')).error === 'in_review' && !(await tryAs(db, OWNER, `select public.subscription_checkout($1)`, [mensual.id])).ok)
check('owner cannot approve it', !(await tryAs(db, OWNER, `select public.platform_decide_invoice($1, true)`, [inv.id], AAL2)).ok)
check('operator without aal2 cannot approve it', !(await tryAs(db, OP, `select public.platform_decide_invoice($1, true)`, [inv.id])).ok)
const list = await tryAs(db, OP, `select * from public.platform_invoices_list(50)`, [], AAL2)
check('operator lists charges to confirm first', list.ok && list.rows[0].id === inv.id && list.rows[0].status === 'por_confirmar', list.err)

const rej = await tryAs(db, OP, `select public.platform_decide_invoice($1, false, 'No llegó la transferencia')`, [inv.id], AAL2)
const inv4 = (await db.query(`select status, reject_reason from public.platform_invoices where id=$1`, [inv.id])).rows[0]
check('operator rejects: back to pending with the reason', rej.ok && inv4.status === 'pendiente' && inv4.reject_reason === 'No llegó la transferencia', rej.err ?? inv4)
await as(db, OWNER, `select public.subscription_report_transfer(null)`)
const appr = await tryAs(db, OP, `select public.platform_decide_invoice($1, true)`, [inv.id], AAL2)
const subA = (await db.query(`select status, plan_id, period_end::text pe, trial_ends from public.subscriptions where owner_id=$1`, [OWNER])).rows[0]
const invA = (await db.query(`select status, period_end::text pe from public.platform_invoices where id=$1`, [inv.id])).rows[0]
check('operator approves: subscription active on the plan until the period end', appr.ok && invA.status === 'pagada' && subA.status === 'activa' && subA.plan_id === mensual.id && subA.pe === invA.pe && subA.trial_ends === null, appr.err ?? [subA, invA])
const ev = (await as(db, OP, `select details from public.platform_events(10)`, [], AAL2)).rows
check('the payment is in the subscription history', ev.some((e) => e.details.payment?.amount === 15000))
check('an approved charge cannot be approved again', !(await tryAs(db, OP, `select public.platform_decide_invoice($1, true)`, [inv.id], AAL2)).ok)

// Next period + permanent code
const co2 = await tryAs(db, OWNER, `select public.subscription_checkout($1) id`, [mensual.id])
const next = (await db.query(`select period_start::text ps, amount from public.platform_invoices where id=$1`, [co2.rows?.[0].id])).rows[0]
const d1 = (await db.query(`select ($1::date + 1)::text d`, [invA.pe])).rows[0].d
check('the next charge starts the day after the paid period', co2.ok && next.ps === d1, co2.err ?? next)
check('the same code twice by the same customer is rejected', (await apply(OWNER, 'BIENVENIDA')).error === 'used')
const perma = await apply(OWNER, 'PERMA')
check('a permanent code discounts this charge', perma.ok && perma.amount === 10000, perma)
check('and stays on the subscription', (await as(db, OWNER, `select public.my_subscription() s`)).rows[0].s.discount?.code === 'PERMA')

// single-use stock + 100 % code activates right away
const u1 = await apply(OTHER, 'NOEXISTE')
check('rate limit counts tries (still answering)', u1.error === 'no_invoice' || u1.error === 'invalid', u1)
await as(db, OTHER, `select public.subscription_checkout($1)`, [mensual.id])
check('a single-use code works once', (await apply(OTHER, 'UNO')).ok === true)
await mk('GRATIS', 'percent=100')
const OWN3 = await newUser(db, 'tercero'); await db.query(`insert into public.owners (user_id) values ($1)`, [OWN3])
check('the stock is used up for others', (await (async () => { await as(db, OWN3, `select public.subscription_checkout($1)`, [mensual.id]); return apply(OWN3, 'UNO') })()).error === 'exhausted')
const g = await apply(OWN3, 'GRATIS')
const s3 = (await db.query(`select status from public.subscriptions where owner_id=$1`, [OWN3])).rows[0]
check('a 100 % code pays the charge and activates the subscription', g.ok && g.amount === 0 && s3.status === 'activa', [g, s3])
const uses = await tryAs(db, OP, `select * from public.platform_discount_uses()`, [], AAL2)
check('operator sees uses per code', uses.ok && uses.rows.length >= 3, uses.err)
check('owner cannot see uses', !(await tryAs(db, OWNER, `select * from public.platform_discount_uses()`, [], AAL2)).ok)

// Suspended customers can still pay to get back in
await as(db, OP, `select public.platform_update_subscription($1,$2,'suspendida',null,null,null)`, [OTHER, mensual.id], AAL2)
check('a suspended customer still reads their subscription to pay', (await tryAs(db, OTHER, `select public.my_subscription()`)).ok)

// Rate limit
let limited = false
for (let k = 0; k < 12 && !limited; k++) limited = (await apply(OWN3, `NOPE${k}`)).error === 'too_many'
check('code tries are rate limited', limited)

report()
