// T10 checks: attendance isolation, same-school class/student, uniqueness, members can mark/unmark.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), A = await newUser(db, 'ana'), U = await newUser(db, 'uri'), X = await newUser(db, 'xavi')
await db.query(`select public.grant_ceo('ceo@test.cl')`)
const s1 = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const s2 = (await as(db, CEO, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user'), ($4,$5,'admin')`, [s1, A, U, s2, X])
const one = async (who, sql, params) => (await as(db, who, sql, params)).rows[0].id
const c1 = await one(A, `insert into public.classes (school_id, name) values ($1,'BJJ') returning id`, [s1])
const c2 = await one(X, `insert into public.classes (school_id, name) values ($1,'Karate') returning id`, [s2])
const st1 = await one(A, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Juan','Pérez') returning id`, [s1])
const st2 = await one(X, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Otro','Dos') returning id`, [s2])

const mark = await tryAs(db, U, `insert into public.attendance (school_id, class_id, student_id) values ($1,$2,$3) returning created_by`, [s1, c1, st1])
check('user role marks attendance', mark.ok, mark.err)
check('created_by is the caller', mark.rows?.[0]?.created_by === U)
check('double mark same day rejected', !(await tryAs(db, U, `insert into public.attendance (school_id, class_id, student_id) values ($1,$2,$3)`, [s1, c1, st1])).ok)
check('same student next day allowed', (await tryAs(db, U, `insert into public.attendance (school_id, class_id, student_id, date) values ($1,$2,$3, current_date - 1)`, [s1, c1, st1])).ok)
check('far-future date rejected', !(await tryAs(db, U, `insert into public.attendance (school_id, class_id, student_id, date) values ($1,$2,$3, current_date + 10)`, [s1, c1, st1])).ok)
check('class from another school rejected', !(await tryAs(db, A, `insert into public.attendance (school_id, class_id, student_id) values ($1,$2,$3)`, [s1, c2, st1])).ok)
check('student from another school rejected', !(await tryAs(db, A, `insert into public.attendance (school_id, class_id, student_id) values ($1,$2,$3)`, [s1, c1, st2])).ok)
check('other school admin sees no school 1 attendance', (await as(db, X, `select count(*)::int c from public.attendance where school_id=$1`, [s1])).rows[0].c === 0)
check('other school admin cannot mark in school 1', !(await tryAs(db, X, `insert into public.attendance (school_id, class_id, student_id, date) values ($1,$2,$3, current_date - 2)`, [s1, c1, st1])).ok)
const xDel = await tryAs(db, X, `delete from public.attendance where school_id=$1`, [s1])
check('other school admin cannot unmark school 1', !xDel.ok || xDel.affected === 0)
const unmark = await tryAs(db, U, `delete from public.attendance where class_id=$1 and student_id=$2 and date=current_date`, [c1, st1])
check('user role unmarks', unmark.ok && unmark.affected === 1, unmark.err)
await as(db, A, `delete from public.classes where id=$1`, [c1])
check('deleting the class removes its attendance', (await db.query(`select count(*)::int c from public.attendance where class_id=$1`, [c1])).rows[0].c === 0)

report()
