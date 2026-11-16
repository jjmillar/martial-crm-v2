// Student public profile: the student publishes it from Ajustes; anyone reads only what they chose to show.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), S1 = await newUser(db, 'cami'), S2 = await newUser(db, 'pedro'), U = await newUser(db, 'staff')
await db.query(`select public.grant_ceo('ceo@test.cl')`)
const sc = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'user')`, [sc, U])
const mk = async (user, first, last, rut) => (await as(db, CEO, `insert into public.students (school_id, first_name, first_last_name, second_last_name, rut, email, address, birth_date, belt, belt_degree, user_id)
  values ($1,$2,$3,'Secreto',$4,'x@test.cl','Calle Privada 1','2000-01-01','Azul',2,$5) returning id`, [sc, first, last, rut, user])).rows[0].id
const st1 = await mk(S1, 'Camila', 'Medel', '11111111-1')
const st2 = await mk(S2, 'Pedro', 'Pérez', '7654321-6')
const save = (user, sid, handle, published = true, extra = [null, null, true, true, true]) =>
  tryAs(db, user, `select (public.save_my_public_profile($1,$2,$3,$4,$5,$6,$7,$8)).handle h`, [sid, handle, published, ...extra])

const anonPrivate = await tryAs(db, null, `select public.student_public_profile('dojo-uno','camila-medel') p`)
check('no profile until the student saves one', anonPrivate.ok && anonPrivate.rows[0].p === null)

const r1 = await save(S1, st1, ' Camila-Medel ', false, ['Cinturón azul', 'Entreno BJJ', true, true, true])
check('student saves their profile (handle normalized)', r1.ok && r1.rows[0].h === 'camila-medel', r1.err)
check('unpublished profile is not public', (await as(db, null, `select public.student_public_profile('dojo-uno','camila-medel') p`)).rows[0].p === null)

await save(S1, st1, 'camila-medel', true, ['Cinturón azul', 'Entreno BJJ', true, true, true])
const pub = (await as(db, null, `select public.student_public_profile('dojo-uno','camila-medel') p`)).rows[0].p
check('published profile is public with name, belt, stats and skills', pub?.name === 'Camila Medel' && pub.belt === 'Azul' && pub.stats?.level === 1 && Array.isArray(pub.skills) && pub.school.slug === 'dojo-uno', pub)
const leak = JSON.stringify(pub)
check('no private data leaks (RUT, surname 2, email, address, birth date)', !/11111111|Secreto|x@test|Privada|2000-01-01/.test(leak), leak)

await save(S1, st1, 'camila-medel', true, [null, null, false, false, false])
const hidden = (await as(db, null, `select public.student_public_profile('dojo-uno','camila-medel') p`)).rows[0].p
check('hidden sections are not returned', hidden.belt === null && hidden.stats === null && hidden.skills === null, hidden)

const taken = await save(S2, st2, 'camila-medel')
check('handle unique within the school', !taken.ok && /handle taken/.test(taken.err), taken.err)
const bad = await save(S2, st2, 'no válido!')
check('invalid handle rejected', !bad.ok)
const other = await save(S2, st1, 'pedro')
check("cannot save someone else's profile", !other.ok, other.err)
const staff = await save(U, st1, 'cami2')
check('staff cannot edit a student profile', !staff.ok)
const direct = await tryAs(db, S1, `insert into public.student_profiles (student_id, school_id, handle) values ($1,$2,'directo')`, [st2, sc])
check('no direct writes', !direct.ok)

check('student sees own profile row', (await as(db, S1, `select count(*)::int c from public.student_profiles`)).rows[0].c === 1)
check('another student does not see it', (await as(db, S2, `select count(*)::int c from public.student_profiles`)).rows[0].c === 0)
check('staff sees school profiles', (await as(db, U, `select count(*)::int c from public.student_profiles`)).rows[0].c === 1)

await as(db, CEO, `update public.students set active = false where id = $1`, [st1])
check('inactive student profile is not public', (await as(db, null, `select public.student_public_profile('dojo-uno','camila-medel') p`)).rows[0].p === null)
report()
