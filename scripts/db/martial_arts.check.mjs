// Martial arts per school (copied from the original catalog, then edited), belts per student and achievements.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const OWNER = await newUser(db, 'owner'), ADM = await newUser(db, 'adm'), USR = await newUser(db, 'usr'), STU = await newUser(db, 'alumna')
const OTHER = await newUser(db, 'otro'), OWNER2 = await newUser(db, 'owner2')
await db.query(`insert into public.owners (user_id) values ($1), ($2)`, [OWNER, OWNER2])
const sc = (await as(db, OWNER, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const sc2 = (await as(db, OWNER2, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user')`, [sc, ADM, USR])
const st = (await as(db, OWNER, `insert into public.students (school_id, first_name, first_last_name, second_last_name, rut, user_id, enrollment_date)
  values ($1,'Camila','Medel','Secreta','11111111-1',$2, current_date - 400) returning id`, [sc, STU])).rows[0].id
const st2 = (await as(db, OWNER2, `insert into public.students (school_id, first_name, first_last_name, rut, user_id) values ($1,'Pedro','Pérez','7654321-6',$2) returning id`, [sc2, OTHER])).rows[0].id

// Original catalog
const tpl = (await as(db, ADM, `select count(*)::int c from public.art_templates`)).rows[0].c
check('catalog has the 6 arts', tpl === 6, tpl)
const kids = (await as(db, ADM, `select count(distinct art_key)::int c from public.belt_templates where track = 'kids'`)).rows[0].c
check('every art has kids belts', kids === 6, kids)
check('anon cannot read the catalog', !(await tryAs(db, null, `select count(*) from public.belt_templates`)).ok)
check('nobody edits the catalog', !(await tryAs(db, OWNER, `update public.belt_templates set name = 'X'`)).ok || (await db.query(`select count(*)::int c from public.belt_templates where name = 'X'`)).rows[0].c === 0)

// Copy into the school
check('a "usuario" member cannot add arts', !(await tryAs(db, USR, `select public.add_school_art($1,'judo')`, [sc])).ok)
check("another school's owner cannot add arts here", !(await tryAs(db, OWNER2, `select public.add_school_art($1,'judo')`, [sc])).ok)
const judo = await tryAs(db, ADM, `select public.add_school_art($1,'judo') id`, [sc])
check('admin adds Judo from the catalog', judo.ok, judo.err)
const judoId = judo.rows[0].id
const copied = (await db.query(`select count(*)::int c from public.school_belts where art_id = $1`, [judoId])).rows[0].c
const orig = (await db.query(`select count(*)::int c from public.belt_templates where art_key = 'judo'`)).rows[0].c
check('belts copied (adults + kids)', copied === orig && copied > 0, { copied, orig })
check('adding it twice fails', /art exists/.test((await tryAs(db, ADM, `select public.add_school_art($1,'judo')`, [sc])).err ?? ''))
await as(db, OWNER, `select public.add_school_art($1,'bjj')`, [sc])

// Edit the copy: the catalog stays untouched
const r = await tryAs(db, ADM, `update public.school_belts set name = 'Amarillo dorado', color = '#ddbb00' where art_id = $1 and name = 'Amarillo' and track = 'adultos'`, [judoId])
check('admin edits a belt of the school', r.ok && r.affected === 1, r.err)
check('the original catalog is unchanged', (await db.query(`select count(*)::int c from public.belt_templates where art_key='judo' and name='Amarillo'`)).rows[0].c === 2)
const own = await tryAs(db, ADM, `insert into public.school_arts (school_id, name) values ($1,'Kickboxing') returning id`, [sc])
check('admin creates an own art', own.ok, own.err)
check('admin adds a belt to it', (await tryAs(db, ADM, `insert into public.school_belts (school_id, art_id, track, position, name, color) values ($1,$2,'adultos',1,'Blanco','#f4f4f7')`, [sc, own.rows[0].id])).ok)
check('a "usuario" member cannot edit belts', (await tryAs(db, USR, `update public.school_belts set name = 'X' where school_id = $1`, [sc])).affected === 0)
check('bad color rejected', !(await tryAs(db, ADM, `update public.school_belts set color = 'red' where art_id = $1`, [judoId])).ok)
check('another school sees none', (await as(db, OWNER2, `select count(*)::int c from public.school_belts where school_id = $1`, [sc])).rows[0].c === 0)
check('the student reads the school belts', (await as(db, STU, `select count(*)::int c from public.school_belts where school_id = $1`, [sc])).rows[0].c > 0)
check('anon reads nothing', !(await tryAs(db, null, `select count(*) from public.school_arts`)).ok)

// Student arts
const belt = async (name, track = 'adultos', art = judoId) => (await db.query(`select id from public.school_belts where art_id=$1 and name=$2 and track=$3`, [art, name, track])).rows[0].id
const blanco = await belt('Blanco'), naranja = await belt('Naranja'), negro = await belt('Negro'), kidsAz = await belt('Azul', 'kids')
const ins = await tryAs(db, USR, `insert into public.student_arts (school_id, student_id, art_id, belt_id) values ($1,$2,$3,$4) returning id`, [sc, st, judoId, blanco])
check('the team gives the student an art and belt', ins.ok, ins.err)
const sa = ins.rows[0].id
check('no graduation for the starting belt', (await db.query(`select count(*)::int c from public.achievements`)).rows[0].c === 0)
check('a belt of another art is rejected', !(await tryAs(db, USR, `update public.student_arts set belt_id = $2 where id = $1`, [sa, await belt('Azul', 'adultos', (await db.query(`select id from public.school_arts where template_key='bjj'`)).rows[0].id)])).ok)
check('degree beyond the belt is rejected', /degree out of range/.test((await tryAs(db, USR, `update public.student_arts set degree = 2 where id = $1`, [sa])).err ?? ''))
check("another school's student can't be linked", !(await tryAs(db, OWNER, `insert into public.student_arts (school_id, student_id, art_id) values ($1,$2,$3)`, [sc, st2, judoId])).ok)
check('the student cannot change their own belt', (await tryAs(db, STU, `update public.student_arts set belt_id = $2 where id = $1`, [sa, negro])).affected === 0)
check('the student reads their own arts', (await as(db, STU, `select count(*)::int c from public.student_arts`)).rows[0].c === 1)
check('another student does not', (await as(db, OTHER, `select count(*)::int c from public.student_arts`)).rows[0].c === 0)

await as(db, USR, `update public.student_arts set belt_id = $2, since = current_date - 3 where id = $1`, [sa, naranja])
const g = (await db.query(`select kind, title, date = current_date - 3 d from public.achievements where student_id = $1`, [st])).rows
check('promotion creates a graduation', g.length === 1 && g[0].kind === 'graduacion' && g[0].title === 'Cinturón naranja' && g[0].d, g)
await as(db, USR, `update public.student_arts set belt_id = $2 where id = $1`, [sa, blanco])
check('going down is not a graduation', (await db.query(`select count(*)::int c from public.achievements`)).rows[0].c === 1)
await as(db, USR, `update public.student_arts set belt_id = $2 where id = $1`, [sa, negro])
await as(db, USR, `update public.student_arts set degree = 2 where id = $1`, [sa])
const last = (await db.query(`select title from public.achievements order by created_at desc, title limit 3`)).rows.map(r => r.title)
check('higher degree is a graduation ("2º dan")', last.includes('Cinturón negro · 2º dan'), last)
check('a belt in use cannot be deleted', !(await tryAs(db, ADM, `delete from public.school_belts where id = $1`, [negro])).ok)
check('an art in use cannot be deleted', !(await tryAs(db, ADM, `delete from public.school_arts where id = $1`, [judoId])).ok)

// Tournaments submitted by the student
const sub = (user, sid, title = 'Copa Santiago') => tryAs(db, user, `select public.submit_achievement($1,$2,current_date - 10,'oro','-66 kg',$3,null) id`, [sid, title, judoId])
const s1 = await sub(STU, st)
check('student submits a tournament (pending)', s1.ok, s1.err)
check("can't submit for someone else", !(await sub(STU, st2)).ok)
check('anon cannot submit', !(await sub(null, st)).ok)
check('pending is not public-ready', (await db.query(`select status from public.achievements where id = $1`, [s1.rows[0].id])).rows[0].status === 'pendiente')
check('the student cannot approve it', (await tryAs(db, STU, `update public.achievements set status = 'aprobado' where id = $1`, [s1.rows[0].id])).affected === 0)
check('no direct inserts by students', !(await tryAs(db, STU, `insert into public.achievements (school_id, student_id, kind, title) values ($1,$2,'escuela','Yo')`, [sc, st])).ok)
const ap = await tryAs(db, USR, `update public.achievements set status = 'aprobado' where id = $1 returning decided_by`, [s1.rows[0].id])
check('the team approves it (stamped)', ap.ok && ap.rows[0].decided_by === USR, ap.err)
const s2 = await sub(STU, st, 'Open Valpo')
check('student withdraws a pending one', (await tryAs(db, STU, `select public.withdraw_achievement($1)`, [s2.rows[0].id])).ok)
check("can't withdraw an approved one", !(await tryAs(db, STU, `select public.withdraw_achievement($1)`, [s1.rows[0].id])).ok)
check('another school does not see them', (await as(db, OWNER2, `select count(*)::int c from public.achievements`)).rows[0].c === 0)

// School badges
const badge = await tryAs(db, ADM, `insert into public.school_badges (school_id, name, icon) values ($1,'Mejor compañero','🤝') returning id`, [sc])
check('admin creates a badge', badge.ok, badge.err)
check('"usuario" cannot create badges', !(await tryAs(db, USR, `insert into public.school_badges (school_id, name) values ($1,'X')`, [sc])).ok)
check('team awards it', (await tryAs(db, USR, `insert into public.achievements (school_id, student_id, kind, title, badge_id) values ($1,$2,'escuela','Mejor compañero',$3)`, [sc, st, badge.rows[0].id])).ok)
check("a badge of another school can't be used", !(await tryAs(db, OWNER2, `insert into public.achievements (school_id, student_id, kind, title, badge_id) values ($1,$2,'escuela','X',$3)`, [sc2, st2, badge.rows[0].id])).ok)

// Milestones
const cls = (await as(db, OWNER, `insert into public.classes (school_id, name, color) values ($1,'Judo','#3d9be0') returning id`, [sc])).rows[0].id
await db.query(`insert into public.attendance (school_id, class_id, student_id, date, confirmed_at)
  select $1, $2, $3, current_date - (i * 7), now() from generate_series(1, 12) i`, [sc, cls, st])
const ms = (await as(db, STU, `select public.student_achievements($1) m`, [st])).rows[0].m
const keys = ms.map(m => m.key)
check('milestones: first class, 10 classes, 4 and 12-week streaks, 1 year', ['clases-1', 'clases-10', 'racha-4', 'racha-12', 'antiguedad-1'].every(k => keys.includes(k)) && !keys.includes('clases-25'), keys)
check("another student can't read them", !(await tryAs(db, OTHER, `select public.student_achievements($1)`, [st])).ok)

// Public profile
const save = await tryAs(db, STU, `select (public.save_my_public_profile($1,'camila',true,null,null,true,true,true,true)).show_achievements a`, [st])
check('student saves profile with the new achievements switch', save.ok && save.rows[0].a === true, save.err)
const pub = (await as(db, null, `select public.student_public_profile('dojo-uno','camila') p`)).rows[0].p
check('public profile shows belts per art', pub.arts?.length === 1 && pub.arts[0].belt === 'Negro' && pub.arts[0].degree_text === '2º dan', pub.arts)
check('public profile shows approved achievements only', pub.achievements.length === 5 && !pub.achievements.some(a => a.title === 'Open Valpo') && pub.milestones.length >= 5, pub.achievements.map(a => a.title))
check('no private data leaks', !/11111111|Secreta/.test(JSON.stringify(pub)))
await as(db, STU, `select public.save_my_public_profile($1,'camila',true,null,null,true,true,true,false)`, [st])
const hidden = (await as(db, null, `select public.student_public_profile('dojo-uno','camila') p`)).rows[0].p
check('achievements can be hidden', hidden.achievements === null && hidden.milestones === null)
check('old 8-argument save still works', (await tryAs(db, STU, `select public.save_my_public_profile($1,'camila',true,null,null,true,true,true)`, [st])).ok)
check('internal milestones function is not exposed', !(await tryAs(db, STU, `select public.student_milestones($1)`, [st])).ok)
report()
