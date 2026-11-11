// T7 checks: enrollments isolation, same-school student/plan, one active per student+plan, plan delete restrict.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), A = await newUser(db, 'ana'), U = await newUser(db, 'uri'), X = await newUser(db, 'xavi')
await db.query(`select public.grant_ceo('ceo@test.cl')`)
const s1 = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const s2 = (await as(db, CEO, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user'), ($4,$5,'admin')`, [s1, A, U, s2, X])
const st1 = (await as(db, A, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Juan','Pérez') returning id`, [s1])).rows[0].id
const st2 = (await as(db, X, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Otro','Dos') returning id`, [s2])).rows[0].id
const p1 = (await as(db, A, `insert into public.plans (school_id, name, price) values ($1,'Mensual',35000) returning id`, [s1])).rows[0].id
const p2 = (await as(db, X, `insert into public.plans (school_id, name, price) values ($1,'Mensual',30000) returning id`, [s2])).rows[0].id

const e1 = await tryAs(db, U, `insert into public.enrollments (school_id, student_id, plan_id, price, ends_at) values ($1,$2,$3,35000, current_date + 30) returning id, created_by`, [s1, st1, p1])
check('user role enrolls a student', e1.ok, e1.err)
check('created_by defaults to the caller', e1.rows?.[0]?.created_by === U, e1.rows?.[0])
const eid = e1.rows?.[0]?.id
const spoof = await as(db, U, `insert into public.enrollments (school_id, student_id, plan_id, price, status, created_by) values ($1,$2,$3,1,'pausada',$4) returning created_by`, [s1, st1, p1, A])
check('created_by cannot be spoofed', spoof.rows[0].created_by === U, spoof.rows[0])
const dupActive = await tryAs(db, A, `insert into public.enrollments (school_id, student_id, plan_id, price) values ($1,$2,$3,35000)`, [s1, st1, p1])
check('second active enrollment in same plan rejected', !dupActive.ok, dupActive.err)
await as(db, U, `update public.enrollments set status='cancelada' where id=$1`, [eid])
const reEnroll = await tryAs(db, A, `insert into public.enrollments (school_id, student_id, plan_id, price) values ($1,$2,$3,35000)`, [s1, st1, p1])
check('re-enroll allowed after cancelling', reEnroll.ok, reEnroll.err)
const crossStudent = await tryAs(db, A, `insert into public.enrollments (school_id, student_id, plan_id, price) values ($1,$2,$3,1)`, [s1, st2, p1])
check('student from another school rejected', !crossStudent.ok, crossStudent.err)
const crossPlan = await tryAs(db, A, `insert into public.enrollments (school_id, student_id, plan_id, price) values ($1,$2,$3,1)`, [s1, st1, p2])
check('plan from another school rejected', !crossPlan.ok, crossPlan.err)
const badDates = await tryAs(db, A, `insert into public.enrollments (school_id, student_id, plan_id, price, start_date, ends_at) values ($1,$2,$3,1,'2026-05-01','2026-04-01')`, [s1, st1, p1])
check('ends_at before start rejected', !badDates.ok, badDates.err)
const xRead = await as(db, X, `select count(*)::int c from public.enrollments where school_id=$1`, [s1])
check('other school admin sees none of school 1', xRead.rows[0].c === 0)
const xIns = await tryAs(db, X, `insert into public.enrollments (school_id, student_id, plan_id, price) values ($1,$2,$3,1)`, [s1, st1, p1])
check('other school admin cannot enroll into school 1', !xIns.ok, xIns.err)
const delU = await tryAs(db, U, `delete from public.enrollments where id=$1`, [eid])
check('user role cannot delete enrollments', !delU.ok || delU.affected === 0, delU.err)
const delPlan = await tryAs(db, A, `delete from public.plans where id=$1`, [p1])
check('plan with enrollments cannot be deleted', !delPlan.ok, delPlan.err)
await as(db, A, `delete from public.students where id=$1`, [st1])
check('deleting the student removes their enrollments', (await db.query(`select count(*)::int c from public.enrollments where student_id=$1`, [st1])).rows[0].c === 0)

report()
