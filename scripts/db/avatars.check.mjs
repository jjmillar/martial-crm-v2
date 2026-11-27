// Migration 20261127000004: profile photos. Paths under the owner's own folder; avatar_access() decides who reads and
// writes each object (the storage policies use it); students and guardians set their own photo through an RPC.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const one = async (sql, p) => (await db.query(sql, p)).rows[0]
const OWNER = await newUser(db, 'owner'), ADM = await newUser(db, 'adm'), USR = await newUser(db, 'usr'), OWNER2 = await newUser(db, 'owner2')
const ALU = await newUser(db, 'alumna'), PAPA = await newUser(db, 'papa'), OTHER = await newUser(db, 'otra')
await db.query(`insert into public.owners (user_id) values ($1), ($2)`, [OWNER, OWNER2])
const sc = (await as(db, OWNER, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const sc2 = (await as(db, OWNER2, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user')`, [sc, ADM, USR])
const st = (await as(db, OWNER, `insert into public.students (school_id, first_name, first_last_name, user_id) values ($1,'Ana','Uno',$2) returning id`, [sc, ALU])).rows[0].id
const kid = (await one(`insert into public.students (school_id, first_name, first_last_name) values ($1,'Kid','Uno') returning id`, [sc])).id
await db.query(`insert into public.student_guardians (student_id, guardian_id, school_id) values ($1,$2,$3)`, [kid, PAPA, sc])
const te = (await one(`insert into public.teachers (school_id, first_name, first_last_name) values ($1,'Profe','Uno') returning id`, [sc])).id
const stPath = `${sc}/students/${st}/a1.webp`, kidPath = `${sc}/students/${kid}/k1.webp`, tePath = `${sc}/teachers/${te}/t1.webp`
const acc = async (who, path, write) => (await tryAs(db, who, `select public.avatar_access($1, $2) ok`, [path, write])).rows?.[0]?.ok === true

// ---- Paths stay in the owner's folder --------------------------------------------------------------------------------
check('student photo path must be its own folder', !(await tryAs(db, ADM, `update public.students set avatar_url = $2 where id = $1`, [st, `${sc}/students/${kid}/x.webp`])).ok)
check('no external links as photo', !(await tryAs(db, ADM, `update public.students set avatar_url = 'https://evil.example/x.png' where id = $1`, [st])).ok)
check('no ".." in the path', !(await tryAs(db, ADM, `update public.students set avatar_url = $2 where id = $1`, [st, `${sc}/students/${st}/../x.webp`])).ok)
const okSet = await tryAs(db, USR, `update public.students set avatar_url = $2 where id = $1`, [st, stPath])
check('staff of the school set a student photo', okSet.ok, okSet.err)
check('teacher photo path must be its own folder', !(await tryAs(db, ADM, `update public.teachers set avatar_url = $2 where id = $1`, [te, `${sc}/teachers/${st}/x.webp`])).ok)
check('admin sets a teacher photo', (await tryAs(db, ADM, `update public.teachers set avatar_url = $2 where id = $1`, [te, tePath])).ok)
check('own account photo path must be users/<me>/', !(await tryAs(db, ALU, `update public.profiles set avatar_url = $2 where id = $1`, [ALU, `users/${PAPA}/x.webp`])).ok)
check('own account photo is saved', (await tryAs(db, ALU, `update public.profiles set avatar_url = $2 where id = $1`, [ALU, `users/${ALU}/me.webp`])).ok)

// ---- Student / guardian set their own photo --------------------------------------------------------------------------
check('student sets their own photo', (await tryAs(db, ALU, `select public.set_my_student_photo($1, $2)`, [st, `${sc}/students/${st}/b2.webp`])).ok)
check('guardian sets the child photo', (await tryAs(db, PAPA, `select public.set_my_student_photo($1, $2)`, [kid, kidPath])).ok)
check('cannot set another student photo', !(await tryAs(db, ALU, `select public.set_my_student_photo($1, $2)`, [kid, kidPath])).ok)
check('cannot set a path outside the record', !(await tryAs(db, ALU, `select public.set_my_student_photo($1, $2)`, [st, kidPath])).ok)
check('anon cannot call it', !(await tryAs(db, null, `select public.set_my_student_photo($1, null)`, [st])).ok)
check('student removes their photo', (await tryAs(db, ALU, `select public.set_my_student_photo($1, null)`, [st])).ok && (await one(`select avatar_url from public.students where id = $1`, [st])).avatar_url === null)

// ---- Storage access ------------------------------------------------------------------------------------------------------
check('school staff read and write a student photo', (await acc(USR, stPath, false)) && (await acc(USR, stPath, true)))
check('the student reads and writes their own photo', (await acc(ALU, stPath, false)) && (await acc(ALU, stPath, true)))
check('the guardian reads and writes the child photo', (await acc(PAPA, kidPath, false)) && (await acc(PAPA, kidPath, true)))
check('a student cannot read another student photo', !(await acc(ALU, kidPath, false)))
check('another school cannot read a student photo', !(await acc(OWNER2, stPath, false)))
check('an unrelated user cannot read it', !(await acc(OTHER, stPath, false)))
check('anon gets nothing', !(await acc(null, stPath, false)))
check('a photo of a student of another school (wrong folder) is refused', !(await acc(USR, `${sc2}/students/${st}/x.webp`, true)))
check('staff read a teacher photo; only admins write it', (await acc(USR, tePath, false)) && !(await acc(USR, tePath, true)) && (await acc(ADM, tePath, true)))
check('students cannot write a teacher photo', !(await acc(ALU, tePath, true)))
check('own account photo: read and write', (await acc(ALU, `users/${ALU}/x.webp`, true)) && (await acc(ALU, `users/${ALU}/x.webp`, false)))
check('nobody writes another account photo', !(await acc(ADM, `users/${USR}/x.webp`, true)))
check('colleagues see an account photo; strangers do not', (await acc(ADM, `users/${USR}/x.webp`, false)) && !(await acc(OTHER, `users/${USR}/x.webp`, false)))
check('odd paths are refused', !(await acc(ADM, `${sc}/students/${st}`, true)) && !(await acc(ADM, `${sc}/otros/${st}/x.webp`, true)) && !(await acc(ADM, `x/../${sc}/students/${st}/a.webp`, false)))

report()
