// Migration 20261127000001: Contabilidad → Egresos. Admin-only tables, manual expenses, recurring rules (fixed monthly
// and per class taught), teachers' pay mode, the generator (idempotent, follows the rule while pending), audit.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const one = async (sql, p) => (await db.query(sql, p)).rows[0]
const OWNER = await newUser(db, 'owner'), ADM = await newUser(db, 'adm'), USR = await newUser(db, 'usr'), OWNER2 = await newUser(db, 'owner2')
await db.query(`insert into public.owners (user_id) values ($1), ($2)`, [OWNER, OWNER2])
const sc = (await as(db, OWNER, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const sc2 = (await as(db, OWNER2, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user')`, [sc, ADM, USR])
const teacher = async (s, n) => (await one(`insert into public.teachers (school_id, first_name, first_last_name) values ($1,$2,'X') returning id`, [s, n])).id
const t1 = await teacher(sc, 'Uno'), tOther = await teacher(sc2, 'Ajeno')
const { today, mon, prev } = await one(`select (now() at time zone 'America/Santiago')::date::text today,
  date_trunc('month', (now() at time zone 'America/Santiago')::date)::date::text mon,
  (date_trunc('month', (now() at time zone 'America/Santiago')::date) - interval '1 month')::date::text prev`)
const plusDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

// ---- Permissions ------------------------------------------------------------------------------------------------------
const ins = (who, s, extra = '') => tryAs(db, who, `insert into public.expenses (school_id, concept, amount${extra ? ', ' + extra.split('=')[0] : ''}) values ($1, 'Luz', 30000${extra ? ', ' + extra.split('=')[1] : ''}) returning *`, [s])
check('a "user" member cannot register expenses', !(await ins(USR, sc)).ok)
check('another school\'s owner cannot register here', !(await ins(OWNER2, sc)).ok)
check('anon cannot register expenses', !(await ins(null, sc)).ok)
const paid = await ins(ADM, sc, `status='pagado'`)
check('an admin registers an expense already paid', paid.ok, paid.err)
const e1 = paid.rows?.[0]
check('paid stamps paid_at and paid_by', e1?.paid_at && e1.paid_by === ADM, e1)
await db.query(`insert into public.expenses (school_id, concept, amount) values ($1, 'Agua', 9000)`, [sc])
check('a "user" member cannot read expenses', (await as(db, USR, `select count(*)::int n from public.expenses`)).rows[0].n === 0)
check('another school cannot read expenses', (await as(db, OWNER2, `select count(*)::int n from public.expenses`)).rows[0].n === 0)
check('the admin reads them', (await as(db, ADM, `select count(*)::int n from public.expenses`)).rows[0].n === 2)
const forged = await tryAs(db, ADM, `insert into public.expenses (school_id, concept, amount, rule_id, period, auto) values ($1,'x',1,null,$2,true) returning rule_id, period, auto`, [sc, mon])
check('a hand-made expense cannot pose as generated', forged.ok && forged.rows[0].period === null && forged.rows[0].auto === false, forged)
check('audit log records the paid expense', (await one(`select count(*)::int n from public.audit_log where action = 'expense_pagado' and entity_id = $1`, [e1.id])).n === 1)
check('a teacher of another school cannot be used', !(await tryAs(db, ADM, `insert into public.expenses (school_id, concept, amount, teacher_id) values ($1,'x',1,$2)`, [sc, tOther])).ok)
check('a "user" member cannot see or set pay modes', !(await tryAs(db, USR, `insert into public.teacher_pay (teacher_id, school_id, mode) values ($1,$2,'automatica')`, [t1, sc])).ok)
check('a "user" member cannot create rules', !(await tryAs(db, USR, `insert into public.expense_rules (school_id, concept, amount) values ($1,'x',1)`, [sc])).ok)
check('a per-class rule needs a teacher', !(await tryAs(db, ADM, `insert into public.expense_rules (school_id, kind, concept, amount) values ($1,'por_clase','x',1)`, [sc])).ok)
check('"user" cannot run the generator', !(await tryAs(db, USR, `select public.sync_expenses($1)`, [sc])).ok)
check('anon cannot run the generator', !(await tryAs(db, null, `select public.sync_expenses($1)`, [sc])).ok)
check('"user" cannot read the month preview', !(await tryAs(db, USR, `select * from public.expense_rules_month($1)`, [sc])).ok)
check('teacher_classes_between is internal', !(await tryAs(db, ADM, `select public.teacher_classes_between($1, current_date, current_date)`, [t1])).ok)
check('sync_all_expenses is internal', !(await tryAs(db, ADM, `select public.sync_all_expenses()`)).ok)

// ---- Fixed monthly rule (rent) --------------------------------------------------------------------------------------
const startTwoAgo = (await one(`select ($1::date - interval '2 months')::date::text d`, [mon])).d
const rent = (await as(db, ADM, `insert into public.expense_rules (school_id, concept, category, amount, day_of_month, starts_on) values ($1,'Arriendo','arriendo',500000,5,$2) returning id`, [sc, startTwoAgo])).rows[0].id
await as(db, ADM, `select public.sync_expenses($1)`, [sc])
const rentRows = async () => (await db.query(`select * from public.expenses where rule_id = $1 order by period`, [rent])).rows
let rr = await rentRows()
check('fixed rule: one expense per month up to this month', rr.length === 3 && rr.every((e) => e.status === 'pendiente' && e.auto && e.amount === 500000), rr.map((e) => [e.period, e.amount]))
check('fixed rule: due on its day of the month', rr.every((e) => new Date(e.date).getUTCDate() === 5 || String(e.date).endsWith('-05')), rr.map((e) => e.date))
await as(db, ADM, `select public.sync_expenses($1)`, [sc])
check('the generator is idempotent', (await rentRows()).length === 3)
// Pay the first, edit the second by hand, then raise the rent.
await as(db, ADM, `update public.expenses set status = 'pagado', method = 'transferencia' where id = $1`, [rr[0].id])
await as(db, ADM, `update public.expenses set amount = 450000 where id = $1`, [rr[1].id])
await as(db, ADM, `update public.expense_rules set amount = 550000 where id = $1`, [rent])
await as(db, ADM, `select public.sync_expenses($1)`, [sc])
rr = await rentRows()
check('a paid expense keeps its amount', rr[0].amount === 500000 && rr[0].status === 'pagado')
check('a hand-edited expense stops following the rule', rr[1].amount === 450000 && rr[1].auto === false)
check('a pending generated expense follows the rule', rr[2].amount === 550000 && rr[2].auto)
const moved = (await as(db, ADM, `update public.expenses set period = $2, rule_id = null where id = $1 returning period, rule_id`, [rr[2].id, prev])).rows[0]
check('period and rule of a generated expense are fixed', moved.period !== null && moved.rule_id === rent, moved)
check('a generated expense cannot be deleted', (await as(db, ADM, `delete from public.expenses where id = $1`, [rr[2].id])).affectedRows === 0)
await as(db, ADM, `update public.expenses set status = 'anulado' where id = $1`, [rr[2].id])
await as(db, ADM, `select public.sync_expenses($1)`, [sc])
rr = await rentRows()
check('a cancelled expense is not created again', rr.length === 3 && rr[2].status === 'anulado' && rr[2].paid_at === null)
check('audit log records the cancellation', (await one(`select count(*)::int n from public.audit_log where action = 'expense_anulado' and entity_id = $1`, [rr[2].id])).n === 1)
const future = (await as(db, ADM, `insert into public.expense_rules (school_id, concept, amount, day_of_month, starts_on) values ($1,'Internet',25000,10,$2) returning id`, [sc, plusDays(today, 40)])).rows[0].id
await as(db, ADM, `select public.sync_expenses($1)`, [sc])
check('a rule starting later creates nothing yet', (await one(`select count(*)::int n from public.expenses where rule_id = $1`, [future])).n === 0)

// ---- Teacher: manual vs automatic, per class ---------------------------------------------------------------------------
const cls = (await one(`insert into public.classes (school_id, name, teacher_id) values ($1,'BJJ',$2) returning id`, [sc, t1])).id
let num = 1000
for (const d of [1, 3, 8]) await db.query(`insert into public.class_sessions (school_id, number, class_id, date, start_time, end_time, name, teacher_id) values ($1,$2,$3,$4,$5,'21:00','BJJ',$6)`, [sc, ++num, cls, plusDays(prev, d), `19:0${d % 10}`, t1])
await db.query(`insert into public.class_sessions (school_id, number, class_id, date, start_time, end_time, name, teacher_id, not_held) values ($1,$2,$3,$4,'18:00','19:00','BJJ',$5,true)`, [sc, ++num, cls, plusDays(prev, 10), t1])
await db.query(`insert into public.class_sessions (school_id, number, class_id, date, start_time, end_time, name, teacher_id) values ($1,$2,$3,$4,'18:00','19:00','BJJ',null)`, [sc, ++num, cls, plusDays(prev, 12)])
await db.query(`insert into public.class_sessions (school_id, number, class_id, date, start_time, end_time, name, teacher_id) values ($1,$2,$3,$4,'07:00','08:00','BJJ',$5)`, [sc, ++num, cls, mon, t1])
const perClass = (await as(db, ADM, `insert into public.expense_rules (school_id, kind, concept, category, teacher_id, amount, day_of_month, starts_on)
  values ($1,'por_clase','Comisión Uno','comision_profesor',$2,15000,5,$3) returning id`, [sc, t1, prev])).rows[0].id
await as(db, ADM, `select public.sync_expenses($1)`, [sc])
check('manual teacher: the rule creates nothing', (await one(`select count(*)::int n from public.expenses where rule_id = $1`, [perClass])).n === 0)
await as(db, ADM, `insert into public.teacher_pay (teacher_id, school_id, mode) values ($1,$2,'automatica')`, [t1, sc])
await as(db, ADM, `select public.sync_expenses($1)`, [sc])
const pc = (await db.query(`select * from public.expenses where rule_id = $1 order by period`, [perClass])).rows
check('automatic teacher: one expense for the closed month only', pc.length === 1 && String(pc[0].period).length > 0, pc.map((e) => [e.period, e.classes]))
check('per class: counts held sessions of that teacher (not "no se realizó", not others)', pc[0]?.classes === 3 && pc[0].amount === 45000, pc[0])
check('per class: teacher and category on the expense', pc[0]?.teacher_id === t1 && pc[0].category === 'comision_profesor')
const preview = (await as(db, ADM, `select * from public.expense_rules_month($1)`, [sc])).rows.find((x) => x.rule_id === perClass)
check('month preview: classes so far this month', preview && preview.classes === 1 && Number(preview.amount) === 15000, preview)
// A session of the closed month marked not held later → the pending expense follows.
await db.query(`update public.class_sessions set not_held = true where school_id = $1 and date = $2`, [sc, plusDays(prev, 1)])
await as(db, ADM, `select public.sync_expenses($1)`, [sc])
const pc2 = (await one(`select classes, amount from public.expenses where rule_id = $1`, [perClass]))
check('pending per-class expense is recalculated', pc2.classes === 2 && pc2.amount === 30000, pc2)
await as(db, ADM, `update public.teacher_pay set mode = 'manual' where teacher_id = $1`, [t1])
await db.query(`update public.class_sessions set not_held = false where school_id = $1 and date = $2`, [sc, plusDays(prev, 1)])
await as(db, ADM, `select public.sync_expenses($1)`, [sc])
check('back to manual: rules stop updating', (await one(`select classes from public.expenses where rule_id = $1`, [perClass])).classes === 2)

// ---- Deleting a rule ----------------------------------------------------------------------------------------------------
await as(db, ADM, `delete from public.expense_rules where id = $1`, [rent])
const left = (await db.query(`select status, rule_id from public.expenses where concept = 'Arriendo' order by period`)).rows
check('deleting a rule keeps paid / edited / cancelled expenses, without the rule', left.length === 3 && left.every((e) => e.rule_id === null), left)
const pcPending = (await one(`select count(*)::int n from public.expenses where rule_id = $1 and status = 'pendiente' and auto`, [perClass])).n
await as(db, ADM, `delete from public.expense_rules where id = $1`, [perClass])
check('deleting a rule removes its pending generated expenses', pcPending === 1 && (await one(`select count(*)::int n from public.expenses where concept = 'Comisión Uno'`)).n === 0)
check('a hand-made expense can be deleted', (await as(db, ADM, `delete from public.expenses where concept = 'Agua'`)).affectedRows === 1)
check('audit log records the deletion', (await one(`select count(*)::int n from public.audit_log where action = 'expense_deleted'`)).n >= 1)

// ---- Period of the payment (migration 20261127000003) ---------------------------------------------------------------
const pr = await tryAs(db, ADM, `insert into public.expenses (school_id, concept, amount, teacher_id, period_from, period_to, status) values ($1,'Comisión enero',200000,$2,'2026-01-01','2026-01-31','pagado') returning period_from::text f, period_to::text t`, [sc, t1])
check('a manual payment keeps the month it pays for', pr.ok && pr.rows[0].f === '2026-01-01' && pr.rows[0].t === '2026-01-31', pr)
const rg = await tryAs(db, ADM, `insert into public.expenses (school_id, concept, amount, period_from, period_to) values ($1,'Quincena',90000,'2026-03-01','2026-03-15') returning id`, [sc])
check('a manual payment takes any date range', rg.ok, rg.err)
check('the range cannot end before it starts', !(await tryAs(db, ADM, `insert into public.expenses (school_id, concept, amount, period_from, period_to) values ($1,'x',1,'2026-03-15','2026-03-01')`, [sc])).ok)
check('the range needs both dates', !(await tryAs(db, ADM, `insert into public.expenses (school_id, concept, amount, period_from) values ($1,'x',1,'2026-03-15')`, [sc])).ok)
const gen = await one(`select id, period::text p from public.expenses where period is not null limit 1`)
await as(db, ADM, `update public.expenses set period_from = '2020-01-01', period_to = '2020-01-02' where id = $1`, [gen.id])
const gr = await one(`select period_from::text f, period_to::text t from public.expenses where id = $1`, [gen.id])
check('a generated expense always covers its month', gr.f === gen.p && gr.t.slice(0, 7) === gen.p.slice(0, 7) && Number(gr.t.slice(8)) >= 28, [gen, gr])

report()
