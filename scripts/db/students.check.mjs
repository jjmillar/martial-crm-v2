// T3/T4 checks: catalogs + students isolation, role permissions, RUT validation, school_id immutability.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), A = await newUser(db, 'ana'), U = await newUser(db, 'uri'), X = await newUser(db, 'xavi')
await db.query(`select public.grant_ceo('ceo@test.cl')`)
const s1 = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const s2 = (await as(db, CEO, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user'), ($4,$5,'admin')`, [s1, A, U, s2, X])

// RUT check digit
const rut = async (r) => (await db.query(`select public.rut_is_valid($1) v`, [r])).rows[0].v
check('valid RUT accepted', (await rut('11111111-1')) && (await rut('12345678-5')) && (await rut('7654321-6')))
check('RUT with K accepted', await rut('10000013-K'))
check('wrong check digit rejected', !(await rut('12345678-9')))
check('null RUT is valid', await rut(null))

// Catalogs: admin writes, user reads only
const spA = await tryAs(db, A, `insert into public.specialties (school_id, name) values ($1,'BJJ') returning id`, [s1])
check('admin creates specialty', spA.ok, spA.err)
const spU = await tryAs(db, U, `insert into public.specialties (school_id, name) values ($1,'Judo')`, [s1])
check('user cannot create specialty', !spU.ok, spU.err)
check('user reads specialties', (await as(db, U, `select count(*)::int c from public.specialties`)).rows[0].c === 1)
const tgU = await tryAs(db, U, `insert into public.tags (school_id, label) values ($1,'Niños')`, [s1])
check('user cannot create tag', !tgU.ok, tgU.err)
check('admin creates tag', (await tryAs(db, A, `insert into public.tags (school_id, label, icon) values ($1,'Niños','🥋')`, [s1])).ok)
check('other school admin sees no specialties of school 1', (await as(db, X, `select count(*)::int c from public.specialties`)).rows[0].c === 0)
const dup = await tryAs(db, A, `insert into public.specialties (school_id, name) values ($1,'BJJ')`, [s1])
check('duplicate specialty name rejected', !dup.ok, dup.err)

// Students: user can create/update, only admin deletes
const ins = await tryAs(db, U, `insert into public.students (school_id, first_name, middle_name, first_last_name, second_last_name, rut) values ($1,'Juan',' ','Pérez','Soto','12345678-5') returning id, full_name`, [s1])
check('user creates student', ins.ok, ins.err)
check('full_name is generated and trimmed', ins.rows?.[0]?.full_name === 'Juan Pérez Soto', ins.rows?.[0]?.full_name)
const sid = ins.rows?.[0]?.id
const badRut = await tryAs(db, U, `insert into public.students (school_id, first_name, first_last_name, rut) values ($1,'Ana','Rojas','12345678-9')`, [s1])
check('invalid RUT rejected on insert', !badRut.ok, badRut.err)
const dupRut = await tryAs(db, A, `insert into public.students (school_id, first_name, first_last_name, rut) values ($1,'Otro','Rojas','12345678-5')`, [s1])
check('duplicate RUT in same school rejected', !dupRut.ok, dupRut.err)
const otherSchoolRut = await tryAs(db, X, `insert into public.students (school_id, first_name, first_last_name, rut) values ($1,'Otro','Rojas','12345678-5')`, [s2])
check('same RUT allowed in another school', otherSchoolRut.ok, otherSchoolRut.err)
const upd = await tryAs(db, U, `update public.students set belt='Azul', belt_degree=2 where id=$1`, [sid])
check('user updates student', upd.ok && upd.affected === 1, upd.err)
const move = await tryAs(db, CEO, `update public.students set school_id=$2 where id=$1`, [sid, s2])
check('school_id cannot change (even CEO)', !move.ok, move.err)
const delU = await tryAs(db, U, `delete from public.students where id=$1`, [sid])
check('user cannot delete student', !delU.ok || delU.affected === 0, delU.err)

// Isolation
check('other school admin cannot see school 1 students', (await as(db, X, `select count(*)::int c from public.students where school_id=$1`, [s1])).rows[0].c === 0)
const xUpd = await tryAs(db, X, `update public.students set notes='x' where id=$1`, [sid])
check('other school admin cannot update school 1 student', !xUpd.ok || xUpd.affected === 0, xUpd.err)
const xIns = await tryAs(db, X, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Intruso','X')`, [s1])
check('other school admin cannot insert into school 1', !xIns.ok, xIns.err)
check('anon sees no students', ((await tryAs(db, null, `select * from public.students`)).rows ?? []).length === 0)
check('CEO sees students of every school', (await as(db, CEO, `select count(*)::int c from public.students`)).rows[0].c === 2)
const delA = await tryAs(db, A, `delete from public.students where id=$1`, [sid])
check('admin deletes student', delA.ok && delA.affected === 1, delA.err)

report()
