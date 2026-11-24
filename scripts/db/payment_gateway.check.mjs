// Payment confirmation: the student reports a transfer or cash payment → submission → the school's admins approve
// (paid, double check) or reject. An admin marking the payment paid directly also closes the student's report.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const OWNER = await newUser(db, 'owner'), ADM = await newUser(db, 'adm'), USR = await newUser(db, 'profe'), S1 = await newUser(db, 'cami'), S2 = await newUser(db, 'pedro')
await db.query(`insert into public.owners (user_id) values ($1)`, [OWNER])
const sc = (await as(db, OWNER, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user')`, [sc, ADM, USR])
const mk = async (user, first, rut) => (await as(db, OWNER, `insert into public.students (school_id, first_name, first_last_name, rut, user_id) values ($1,$2,'X',$3,$4) returning id`, [sc, first, rut, user])).rows[0].id
const st1 = await mk(S1, 'Camila', '11111111-1'), st2 = await mk(S2, 'Pedro', '7654321-6')
const pay = async (sid, amount = 30000) => (await as(db, OWNER, `insert into public.payments (school_id, student_id, concept, amount) values ($1,$2,'Mensualidad',$3) returning id`, [sc, sid, amount])).rows[0].id
const p1 = await pay(st1), p2 = await pay(st2), p3 = await pay(st1, 5000), p4 = await pay(st1, 7000), p5 = await pay(st2, 9000)
const submit = (user, pid, method = 'transferencia', ref = 'op 123') => tryAs(db, user, `select public.submit_payment($1,$2,$3) id`, [pid, method, ref])

const noConf = await submit(S1, p1)
check('cannot report a transfer while the school has no transfer data', !noConf.ok && /not configured/.test(noConf.err), noConf.err)
const cash = await submit(S1, p4, 'efectivo', 'Le pagué al profe Juan')
check('cash can be reported without transfer data', cash.ok, cash.err)
await as(db, OWNER, `update public.schools set transfer_bank='Banco Estado', transfer_account_type='Cuenta RUT', transfer_account_number='11111111', transfer_holder='Dojo Uno SpA', transfer_rut='76.111.111-1', transfer_email='pagos@dojo.cl' where id=$1`, [sc])
check('student reads the transfer data of their school', (await as(db, S1, `select transfer_account_number n from public.schools where id=$1`, [sc])).rows[0]?.n === '11111111')

const other = await submit(S2, p1)
check("cannot pay someone else's payment", !other.ok, other.err)
const card = await submit(S1, p1, 'tarjeta')
check('only transfer and cash are enabled', !card.ok && /not enabled/.test(card.err), card.err)
const ok1 = await submit(S1, p1)
check('student submits a transfer', ok1.ok, ok1.err)
const dup = await submit(S1, p1)
check('one pending submission per payment', !dup.ok && /already submitted/.test(dup.err), dup.err)
check('payment stays pending until the CEO approves', (await db.query(`select status from public.payments where id=$1`, [p1])).rows[0].status === 'pendiente')
check('student sees own submissions only', (await as(db, S1, `select count(*)::int c from public.payment_submissions`)).rows[0].c === 2 && (await as(db, S2, `select count(*)::int c from public.payment_submissions`)).rows[0].c === 0)
check('school team sees submissions', (await as(db, ADM, `select count(*)::int c from public.payment_submissions`)).rows[0].c === 2)
const direct = await tryAs(db, S1, `insert into public.payment_submissions (payment_id, school_id, student_id, method, amount) values ($1,$2,$3,'transferencia',1)`, [p3, sc, st1])
check('no direct writes', !direct.ok)

const sub1 = ok1.rows[0].id
const studentDecide = await tryAs(db, S1, `select public.decide_payment_submission($1, true)`, [sub1])
check('student cannot approve', !studentDecide.ok)
check('a "usuario" member cannot approve', !(await tryAs(db, USR, `select public.decide_payment_submission($1, true)`, [sub1])).ok)
const adminDecide = await tryAs(db, ADM, `select public.decide_payment_submission($1, true)`, [sub1])
check('school admin approves', adminDecide.ok, adminDecide.err)
const paid = (await db.query(`select status, method, paid_at is not null paid, confirmed_by from public.payments where id=$1`, [p1])).rows[0]
check('approved → payment paid, stamped by the admin', paid.status === 'pagado' && paid.method === 'transferencia' && paid.paid && paid.confirmed_by === ADM, paid)
const s1row = (await db.query(`select status, decided_by from public.payment_submissions where id=$1`, [sub1])).rows[0]
check('the report is approved (double check)', s1row.status === 'aprobada' && s1row.decided_by === ADM, s1row)
const again = await tryAs(db, OWNER, `select public.decide_payment_submission($1, false)`, [sub1])
check('a decided submission cannot be decided again', !again.ok)
const paidAgain = await submit(S1, p1)
check('a paid payment cannot be submitted', !paidAgain.ok && /not pending/.test(paidAgain.err))

const s3 = (await submit(S1, p3)).rows[0].id
await as(db, OWNER, `select public.decide_payment_submission($1, false, 'No llegó la transferencia')`, [s3])
const rej = (await db.query(`select s.status, s.reject_reason, p.status ps from public.payment_submissions s join public.payments p on p.id = s.payment_id where s.id=$1`, [s3])).rows[0]
check('CEO rejects → payment still pending, reason kept', rej.status === 'rechazada' && rej.reject_reason === 'No llegó la transferencia' && rej.ps === 'pendiente', rej)
check('after a rejection the student can try again', (await submit(S1, p3)).ok)

// Single check: the admin marks it paid directly (e.g. WhatsApp) …
await as(db, ADM, `update public.payments set status = 'pagado', method = 'transferencia' where id = $1`, [p5])
check('admin marks a payment paid directly (no report)', (await db.query(`select count(*)::int c from public.payment_submissions where payment_id=$1`, [p5])).rows[0].c === 0)
// … and if the student had reported it, that report closes as approved.
await as(db, ADM, `update public.payments set status = 'pagado', method = 'efectivo' where id = $1`, [p4])
const cashRow = (await db.query(`select status, decided_by from public.payment_submissions where payment_id=$1`, [p4])).rows[0]
check("marking paid directly approves the student's pending report", cashRow.status === 'aprobada' && cashRow.decided_by === ADM, cashRow)
check('a "usuario" member cannot mark paid', (await tryAs(db, USR, `update public.payments set status = 'pagado' where id = $1`, [p3])).affected === 0)
report()
