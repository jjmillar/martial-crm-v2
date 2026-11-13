// Card items 6 + 7: student accounts stay out of staff data; links; self check-in + confirmation; XP/skills.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), A = await newUser(db, 'ana'), U = await newUser(db, 'uri'), X = await newUser(db, 'xavi')
const S = await newUser(db, 'sofi'), S2 = await newUser(db, 'otro')
await db.query(`select public.grant_ceo('ceo@test.cl')`)
const s1 = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const s2 = (await as(db, CEO, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user'), ($4,$5,'admin')`, [s1, A, U, s2, X])
const one = async (who, sql, p) => (await as(db, who, sql, p)).rows[0]
const today = (await db.query(`select (now() at time zone 'America/Santiago')::date::text d, extract(isodow from (now() at time zone 'America/Santiago')::date)::int w`)).rows[0]
const otherDay = (today.w % 7) + 1

const sofia = (await one(A, `insert into public.students (school_id, first_name, first_last_name, rut, email) values ($1,'Sofía','Pérez','11111111-1','sofi@test.cl') returning id`, [s1])).id
const beto = (await one(A, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Beto','Rojas') returning id`, [s1])).id
const foreign = (await one(X, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Ajeno','Dos') returning id`, [s2])).id
const tag = (await one(A, `insert into public.tags (school_id, label) values ($1,'Guardia') returning id`, [s1])).id
const tag2 = (await one(A, `insert into public.tags (school_id, label) values ($1,'Derribos') returning id`, [s1])).id
const cToday = (await one(A, `insert into public.classes (school_id, name) values ($1,'BJJ hoy') returning id`, [s1])).id
const cOther = (await one(A, `insert into public.classes (school_id, name) values ($1,'Otro día') returning id`, [s1])).id
const cForeign = (await one(X, `insert into public.classes (school_id, name) values ($1,'Ajena') returning id`, [s2])).id
await as(db, A, `insert into public.class_schedules (school_id, class_id, weekday, start_time, end_time) values ($1,$2,$3,'19:00','20:00'), ($1,$4,$5,'19:00','20:00')`, [s1, cToday, today.w, cOther, otherDay])
await as(db, X, `insert into public.class_schedules (school_id, class_id, weekday, start_time, end_time) values ($1,$2,$3,'19:00','20:00')`, [s2, cForeign, today.w])
await as(db, A, `insert into public.class_tags (school_id, class_id, tag_id) values ($1,$2,$3), ($1,$2,$4)`, [s1, cToday, tag, tag2])
await as(db, A, `insert into public.payments (school_id, student_id, concept, amount) values ($1,$2,'Cuota',1000), ($1,$3,'Cuota Beto',1000)`, [s1, sofia, beto])

// --- Linking an account (item 6/7)
const uLink = await tryAs(db, U, `update public.students set user_id=$1 where id=$2`, [S, sofia])
check('staff "user" role cannot link a student account', !uLink.ok, uLink.err)
const uOther = await tryAs(db, U, `update public.students set phone='123' where id=$1`, [sofia])
check('staff "user" role still edits student data', uOther.ok && uOther.affected === 1, uOther.err)
const aLink = await tryAs(db, A, `update public.students set user_id=$1 where id=$2`, [S, sofia])
check('admin links a student account', aLink.ok && aLink.affected === 1, aLink.err)
const dupLink = await tryAs(db, A, `update public.students set user_id=$1 where id=$2`, [S, beto])
check('one account = one student per school', !dupLink.ok, dupLink.err)

// --- Student sees only their own things, never staff data
check('student is NOT a staff member', (await one(S, `select public.is_school_member($1) m`, [s1])).m === false)
check('student sees their school', (await as(db, S, `select id from public.schools`)).rows.map((r) => r.id).join() === s1)
check('student sees only their own student row', (await as(db, S, `select id from public.students`)).rows.map((r) => r.id).join() === sofia)
check('student sees only own payments', (await as(db, S, `select concept from public.payments`)).rows.map((r) => r.concept).join() === 'Cuota')
check('student sees classes and schedules of their school', (await as(db, S, `select count(*)::int c from public.classes`)).rows[0].c === 2)
check('student sees no teachers or members', (await as(db, S, `select (select count(*) from public.teachers) + (select count(*) from public.school_members) c`)).rows[0].c == 0)
const sIns = await tryAs(db, S, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Hack','Er')`, [s1])
check('student cannot create students', !sIns.ok, sIns.err)
const sUpd = await tryAs(db, S, `update public.students set notes='x' where id=$1`, [sofia])
check('student cannot edit their record directly', !sUpd.ok || sUpd.affected === 0, sUpd.err)
const sAtt = await tryAs(db, S, `insert into public.attendance (school_id, class_id, student_id) values ($1,$2,$3)`, [s1, cToday, sofia])
check('student cannot insert attendance directly', !sAtt.ok, sAtt.err)

// --- Self check-in
const ci = await tryAs(db, S, `select (public.check_in($1)).*`, [cToday])
check('student checks in to a class scheduled today', ci.ok && ci.rows[0].self_marked === true && ci.rows[0].confirmed_at === null, ci.err ?? ci.rows)
const ci2 = await tryAs(db, S, `select (public.check_in($1)).id`, [cToday])
check('checking in twice is harmless', ci2.ok && ci2.rows[0].id === ci.rows[0].id, ci2.err)
const ciOther = await tryAs(db, S, `select public.check_in($1)`, [cOther])
check('cannot check in to a class not scheduled today', !ciOther.ok, ciOther.err)
const ciForeign = await tryAs(db, S, `select public.check_in($1)`, [cForeign])
check('cannot check in to another school', !ciForeign.ok, ciForeign.err)
const ciNo = await tryAs(db, S2, `select public.check_in($1)`, [cToday])
check('an account without a student link cannot check in', !ciNo.ok, ciNo.err)
const fake = await tryAs(db, U, `insert into public.attendance (school_id, class_id, student_id, self_marked) values ($1,$2,$3,true)`, [s1, cToday, beto])
check('staff cannot fake a self check-in', !fake.ok, fake.err)

let prog = (await one(S, `select public.student_progress($1) p`, [sofia])).p
check('unconfirmed check-in gives no XP yet', prog.xp === 0 && prog.pending === 1, prog)

// Staff confirms
await as(db, U, `update public.attendance set confirmed_at=now() where id=$1`, [ci.rows[0].id])
const conf = (await db.query(`select confirmed_by from public.attendance where id=$1`, [ci.rows[0].id])).rows[0]
check('confirming stamps who confirmed', conf.confirmed_by === U, conf)
const undo = await tryAs(db, S, `select public.undo_check_in($1)`, [cToday])
check('confirmed attendance cannot be undone by the student', undo.ok && (await db.query(`select count(*)::int c from public.attendance where student_id=$1`, [sofia])).rows[0].c === 1)

// Staff marks directly = confirmed; XP and skills
await as(db, A, `insert into public.attendance (school_id, class_id, student_id, date) values ($1,$2,$3,$4::date - 7)`, [s1, cToday, sofia, today.d])
prog = (await one(S, `select public.student_progress($1) p`, [sofia])).p
check('XP = 10 per confirmed attendance, level from XP', prog.xp === 20 && prog.level === 1 && prog.level_xp === 20 && prog.attended === 2, prog)
check('skills = XP per class tag', prog.skills.length === 2 && prog.skills.every((s) => s.xp === 20), prog.skills)
const peek = await tryAs(db, S, `select public.student_progress($1)`, [beto])
check("student cannot read another student's progress", !peek.ok, peek.err)
check("staff reads any student's progress", (await one(U, `select public.student_progress($1) p`, [sofia])).p.xp === 20)
const xPeek = await tryAs(db, X, `select public.student_progress($1)`, [sofia])
check('staff of another school cannot', !xPeek.ok, xPeek.err)

// Undo before confirmation
await db.query(`delete from public.attendance where student_id=$1 and date=$2::date`, [sofia, today.d])
await as(db, S, `select public.check_in($1)`, [cToday])
await as(db, S, `select public.undo_check_in($1)`, [cToday])
check('student can undo an unconfirmed check-in', (await db.query(`select count(*)::int c from public.attendance where student_id=$1 and date=$2::date`, [sofia, today.d])).rows[0].c === 0)

// --- Teacher <-> student link (item 6)
const t1 = (await one(A, `insert into public.teachers (school_id, first_name, first_last_name) values ($1,'Sofía','Pérez') returning id`, [s1])).id
const tl = await tryAs(db, A, `update public.teachers set student_id=$1 where id=$2`, [sofia, t1])
check('admin links a teacher to a student', tl.ok && tl.affected === 1, tl.err)
const tx = await tryAs(db, X, `insert into public.teachers (school_id, first_name, first_last_name, student_id) values ($1,'X','Y',$2)`, [s2, sofia])
check('cannot link a teacher to a student of another school', !tx.ok, tx.err)
const t2 = (await one(A, `insert into public.teachers (school_id, first_name, first_last_name) values ($1,'Otro','Profe') returning id`, [s1])).id
const tdup = await tryAs(db, A, `update public.teachers set student_id=$1 where id=$2`, [sofia, t2])
check('a student links to at most one teacher', !tdup.ok, tdup.err)
await as(db, A, `update public.students set active=false where id=$1`, [sofia])
check('inactive student loses portal access', (await as(db, S, `select count(*)::int c from public.classes`)).rows[0].c === 0)
void foreign
report()
