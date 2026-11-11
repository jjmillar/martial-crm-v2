// T11 checks: payments isolation, users can only register pending, admins confirm, confirmation stamps,
// student delete restricted, enrollment link set null.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), A = await newUser(db, 'ana'), U = await newUser(db, 'uri'), X = await newUser(db, 'xavi')
await db.query(`select public.grant_ceo('ceo@test.cl')`)
const s1 = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const s2 = (await as(db, CEO, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user'), ($4,$5,'admin')`, [s1, A, U, s2, X])
const one = async (who, sql, params) => (await as(db, who, sql, params)).rows[0].id
const st1 = await one(A, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Juan','Pérez') returning id`, [s1])
const st2 = await one(X, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Otro','Dos') returning id`, [s2])
const p1 = await one(A, `insert into public.plans (school_id, name, price) values ($1,'Mensual',35000) returning id`, [s1])
const e1 = await one(A, `insert into public.enrollments (school_id, student_id, plan_id, price) values ($1,$2,$3,35000) returning id`, [s1, st1, p1])

const pend = await tryAs(db, U, `insert into public.payments (school_id, student_id, enrollment_id, concept, amount, method) values ($1,$2,$3,'Mensualidad',35000,'efectivo') returning id, status, paid_at, created_by`, [s1, st1, e1])
check('user registers a pending payment', pend.ok && pend.rows[0].status === 'pendiente' && pend.rows[0].paid_at === null, pend.err ?? pend.rows)
const pid = pend.rows?.[0]?.id
check('user cannot create a payment already paid', !(await tryAs(db, U, `insert into public.payments (school_id, student_id, concept, amount, status) values ($1,$2,'X',1,'pagado')`, [s1, st1])).ok)
const okAttach = await tryAs(db, U, `select public.attach_payment_receipt($1, $2)`, [pid, `${s1}/${pid}/r.png`])
check('member attaches a receipt to a pending payment', okAttach.ok, okAttach.err)
check('receipt path outside the payment folder rejected', !(await tryAs(db, U, `select public.attach_payment_receipt($1, $2)`, [pid, `${s2}/${pid}/r.png`])).ok)
check('other school admin cannot attach', !(await tryAs(db, X, `select public.attach_payment_receipt($1, $2)`, [pid, `${s1}/${pid}/x.png`])).ok)
const declared = await tryAs(db, U, `insert into public.payments (id, school_id, student_id, concept, amount, receipt_path) values (gen_random_uuid(), $1, $2, 'Con comprobante', 5000, 'x') returning receipt_path`, [s1, st1])
check('member can insert a pending payment with receipt_path', declared.ok, declared.err)
const uConfirm = await tryAs(db, U, `update public.payments set status='pagado' where id=$1`, [pid])
check('user cannot confirm', !uConfirm.ok || uConfirm.affected === 0)
const confirm = await as(db, A, `update public.payments set status='pagado' where id=$1 returning paid_at, confirmed_by`, [pid])
check('admin confirms; paid_at and confirmed_by stamped', confirm.rows[0].paid_at !== null && confirm.rows[0].confirmed_by === A, confirm.rows[0])
const uReplace = await tryAs(db, U, `select public.attach_payment_receipt($1, $2)`, [pid, `${s1}/${pid}/otro.png`])
check('member cannot replace the receipt of a confirmed payment', !uReplace.ok, uReplace.err)
check('admin can replace it', (await tryAs(db, A, `select public.attach_payment_receipt($1, $2)`, [pid, `${s1}/${pid}/otro.png`])).ok)
const back = await as(db, A, `update public.payments set status='pendiente' where id=$1 returning paid_at, confirmed_by`, [pid])
check('back to pending clears the stamps', back.rows[0].paid_at === null && back.rows[0].confirmed_by === null)
const direct = await tryAs(db, A, `insert into public.payments (school_id, student_id, concept, amount, status, method) values ($1,$2,'Matrícula',10000,'pagado','transferencia') returning paid_at, confirmed_by`, [s1, st1])
check('admin registers an already-paid payment, stamped', direct.ok && direct.rows[0].paid_at !== null && direct.rows[0].confirmed_by === A, direct.err)
const refund = await as(db, A, `update public.payments set status='reembolsado' where concept='Matrícula' returning paid_at`)
check('refund keeps the original paid_at', refund.rows[0].paid_at !== null)
check('zero amount rejected', !(await tryAs(db, A, `insert into public.payments (school_id, student_id, concept, amount) values ($1,$2,'X',0)`, [s1, st1])).ok)
check('student from another school rejected', !(await tryAs(db, A, `insert into public.payments (school_id, student_id, concept, amount) values ($1,$2,'X',1)`, [s1, st2])).ok)
check('other school admin sees no school 1 payments', (await as(db, X, `select count(*)::int c from public.payments where school_id=$1`, [s1])).rows[0].c === 0)
const xUpd = await tryAs(db, X, `update public.payments set amount=1 where school_id=$1`, [s1])
check('other school admin cannot edit school 1 payments', !xUpd.ok || xUpd.affected === 0)
const uDel = await tryAs(db, U, `delete from public.payments where id=$1`, [pid])
check('user cannot delete payments', !uDel.ok || uDel.affected === 0)
const delStudent = await tryAs(db, A, `delete from public.students where id=$1`, [st1])
check('student with payments cannot be deleted', !delStudent.ok, delStudent.err)
await as(db, A, `delete from public.enrollments where id=$1`, [e1])
check('deleting the enrollment keeps the payment, unlinked', (await db.query(`select enrollment_id from public.payments where id=$1`, [pid])).rows[0].enrollment_id === null)

report()
