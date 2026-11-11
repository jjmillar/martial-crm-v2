// T5 checks: teachers + specialties join, isolation, admin-only writes, cross-school integrity, linked account.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), A = await newUser(db, 'ana'), U = await newUser(db, 'uri'), X = await newUser(db, 'xavi'), O = await newUser(db, 'otro')
await db.query(`select public.grant_ceo('ceo@test.cl')`)
const s1 = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const s2 = (await as(db, CEO, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user'), ($4,$5,'admin'), ($4,$6,'user')`, [s1, A, U, s2, X, O])
const sp1 = (await as(db, A, `insert into public.specialties (school_id, name) values ($1,'BJJ') returning id`, [s1])).rows[0].id
const sp1b = (await as(db, A, `insert into public.specialties (school_id, name) values ($1,'Judo') returning id`, [s1])).rows[0].id
const sp2 = (await as(db, X, `insert into public.specialties (school_id, name) values ($1,'Karate') returning id`, [s2])).rows[0].id

const ins = await tryAs(db, A, `insert into public.teachers (school_id, first_name, first_last_name, rut, user_id) values ($1,'Rorion','Gracie','12345678-5',$2) returning id, full_name`, [s1, U])
check('admin creates teacher linked to a member', ins.ok, ins.err)
check('teacher full_name generated', ins.rows?.[0]?.full_name === 'Rorion Gracie', ins.rows?.[0]?.full_name)
const t1 = ins.rows?.[0]?.id
const byUser = await tryAs(db, U, `insert into public.teachers (school_id, first_name, first_last_name) values ($1,'No','Puede')`, [s1])
check('user role cannot create teachers', !byUser.ok, byUser.err)
const updUser = await tryAs(db, U, `update public.teachers set phone='1' where id=$1`, [t1])
check('user role cannot update teachers', !updUser.ok || updUser.affected === 0, updUser.err)
check('user role reads teachers', (await as(db, U, `select count(*)::int c from public.teachers`)).rows[0].c === 1)

const foreignUser = await tryAs(db, A, `insert into public.teachers (school_id, first_name, first_last_name, user_id) values ($1,'Ajeno','X',$2)`, [s1, O])
check('cannot link an account from another school', !foreignUser.ok && /member of the school/.test(foreignUser.err), foreignUser.err)
const badRut = await tryAs(db, A, `insert into public.teachers (school_id, first_name, first_last_name, rut) values ($1,'Mal','Rut','12345678-9')`, [s1])
check('invalid teacher RUT rejected', !badRut.ok, badRut.err)

const set = await tryAs(db, A, `select public.set_teacher_specialties($1, array[$2,$3]::uuid[])`, [t1, sp1, sp1b])
check('admin sets specialties', set.ok, set.err)
check('two specialties stored', (await db.query(`select count(*)::int c from public.teacher_specialties where teacher_id=$1`, [t1])).rows[0].c === 2)
const reset = await tryAs(db, A, `select public.set_teacher_specialties($1, array[$2]::uuid[])`, [t1, sp1])
check('set replaces the previous list', reset.ok && (await db.query(`select count(*)::int c from public.teacher_specialties where teacher_id=$1`, [t1])).rows[0].c === 1, reset.err)
const cross = await tryAs(db, A, `select public.set_teacher_specialties($1, array[$2]::uuid[])`, [t1, sp2])
check('cannot attach another school specialty (composite FK)', !cross.ok, cross.err)
const crossDirect = await tryAs(db, A, `insert into public.teacher_specialties (teacher_id, specialty_id, school_id) values ($1,$2,$3)`, [t1, sp2, s1])
check('direct cross-school insert rejected', !crossDirect.ok, crossDirect.err)
const userSet = await tryAs(db, U, `select public.set_teacher_specialties($1, array[$2]::uuid[])`, [t1, sp1b])
check('user role cannot set specialties', !userSet.ok, userSet.err)

check('other school admin sees no teachers of school 1', (await as(db, X, `select count(*)::int c from public.teachers where school_id=$1`, [s1])).rows[0].c === 0)
check('other school admin sees no teacher_specialties of school 1', (await as(db, X, `select count(*)::int c from public.teacher_specialties`)).rows[0].c === 0)
const xSet = await tryAs(db, X, `select public.set_teacher_specialties($1, array[]::uuid[])`, [t1])
check('other school admin cannot touch school 1 teacher', !xSet.ok, xSet.err)
const move = await tryAs(db, CEO, `update public.teachers set school_id=$2 where id=$1`, [t1, s2])
check('teacher cannot move schools', !move.ok, move.err)

await as(db, A, `delete from public.specialties where id=$1`, [sp1])
check('deleting a specialty cascades to the join', (await db.query(`select count(*)::int c from public.teacher_specialties where teacher_id=$1`, [t1])).rows[0].c === 0)
await as(db, A, `delete from public.school_members where school_id=$1 and user_id=$2`, [s1, U])
check('removing the member unlinks the teacher account', (await db.query(`select user_id from public.teachers where id=$1`, [t1])).rows[0].user_id === null)
const del = await tryAs(db, A, `delete from public.teachers where id=$1`, [t1])
check('admin deletes teacher', del.ok && del.affected === 1, del.err)

report()
