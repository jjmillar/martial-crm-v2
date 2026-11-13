// SaaS tenancy: customer CEOs (owners) only reach their own schools; the platform admin reaches all.
// Plus the public landing page payload.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const P = await newUser(db, 'plataforma'), O1 = await newUser(db, 'dueno1'), O2 = await newUser(db, 'dueno2'), M = await newUser(db, 'staff1'), Z = await newUser(db, 'nadie')
await db.query(`select public.grant_ceo('plataforma@test.cl')`)
const asService = async (sql, params = []) => { await db.query(`select set_config('request.jwt.claims', '{}', false)`); return db.query(sql, params) }
await asService(`select public.register_owner($1), public.register_owner($2)`, [O1, O2])

const notOwner = await tryAs(db, Z, `select public.create_school('Hack','hack-dojo')`)
check('a plain account cannot create schools', !notOwner.ok, notOwner.err)
const a = (await as(db, O1, `select (public.create_school('Dojo A','dojo-a')).id`)).rows[0].id
const b = (await as(db, O2, `select (public.create_school('Dojo B','dojo-b')).id`)).rows[0].id
check('the creator owns the school', (await db.query(`select owner_id from public.schools where id=$1`, [a])).rows[0].owner_id === O1)

// Isolation between customers
check('owner sees only their own schools', (await as(db, O1, `select id from public.schools`)).rows.map((r) => r.id).join() === a)
await as(db, O2, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Alumno','DeB')`, [b])
check("owner cannot read another owner's students", (await as(db, O1, `select count(*)::int c from public.students`)).rows[0].c === 0)
const cross = await tryAs(db, O1, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Intruso','X')`, [b])
check("owner cannot write into another owner's school", !cross.ok, cross.err)
const del = await tryAs(db, O1, `delete from public.schools where id=$1`, [b])
check("owner cannot delete another owner's school", !del.ok || del.affected === 0, del.err)
check('owner has full admin rights in their school', (await as(db, O1, `select public.has_school_role($1, array['admin']::public.school_role[]) r`, [a])).rows[0].r === true)
check('owner is not a platform admin', (await as(db, O1, `select public.is_ceo() r`)).rows[0].r === false)
check('platform admin sees every school', (await as(db, P, `select count(*)::int c from public.schools`)).rows[0].c === 2)

// Owner manages staff; staff see the owner on top of Miembros
await as(db, O1, `insert into public.school_members (school_id, user_id, role) values ($1,$2,'user')`, [a, M])
check("owner reads their staff's profiles", (await as(db, O1, `select count(*)::int c from public.profiles where id=$1`, [M])).rows[0].c === 1)
const own = (await as(db, M, `select * from public.school_owner($1)`, [a])).rows
check('staff see their school owner (not the platform admin)', own.length === 1 && own[0].user_id === O1, own)

// Requests from the landing page go to that school's owner only
const S = await newUser(db, 'alumna')
const req = (await asService(`select public.register_account_request($1,$2,'alumno','Ana','Uno','11111111-1','ana@test.cl',null) id`, [a, S])).rows[0].id
check('owner sees requests of their school', (await as(db, O1, `select count(*)::int c from public.account_requests`)).rows[0].c === 1)
check("another owner doesn't", (await as(db, O2, `select count(*)::int c from public.account_requests`)).rows[0].c === 0)
const o2dec = await tryAs(db, O2, `select public.decide_account_request($1, true)`, [req])
check("another owner cannot approve it", !o2dec.ok, o2dec.err)
const mdec = await tryAs(db, M, `select public.decide_account_request($1, true)`, [req])
check('staff cannot approve it', !mdec.ok, mdec.err)
await as(db, O1, `select public.decide_account_request($1, true)`, [req])
check('owner approves → the student joins that school', (await as(db, S, `select school_id from public.students`)).rows[0]?.school_id === a)
const regDirect = await tryAs(db, Z, `select public.register_owner($1)`, [Z])
check('nobody can make themselves an owner from the client', !regDirect.ok, regDirect.err)

// Landing page
await as(db, O1, `update public.schools set landing_tagline='Entrena con nosotros', landing_theme='oceano', phone='+56 9 1', enrollment_fee=20000 where id=$1`, [a])
const cls = (await as(db, O1, `insert into public.classes (school_id, name) values ($1,'BJJ') returning id`, [a])).rows[0].id
await as(db, O1, `insert into public.class_schedules (school_id, class_id, weekday, start_time, end_time) values ($1,$2,1,'19:00','20:00')`, [a, cls])
await as(db, O1, `insert into public.plans (school_id, name, price) values ($1,'Mensual',35000)`, [a])
await as(db, O1, `insert into public.school_photos (school_id, path, caption) values ($1,$2,'Tatami')`, [a, `${a}/foto.jpg`])
const L = (await as(db, null, `select public.school_landing('dojo-a') l`)).rows[0].l
check('anyone can load the landing page', L && L.name === 'Dojo A' && L.tagline === 'Entrena con nosotros' && L.theme === 'oceano', L)
check('landing includes photos, schedule and plans', L.photos.length === 1 && L.schedule.length === 1 && L.plans.length === 1 && L.plans[0].price === 35000, L)
check('landing exposes no private data', !JSON.stringify(L).includes('Alumno') && !('owner_id' in L) && !JSON.stringify(L).includes('ana@test.cl'))
await as(db, O1, `update public.schools set landing_show_plans=false, landing_show_schedule=false where id=$1`, [a])
const L2 = (await as(db, null, `select public.school_landing('dojo-a') l`)).rows[0].l
check('owner can hide schedule and plans', L2.plans === null && L2.schedule === null)
await as(db, O1, `update public.schools set landing_enabled=false where id=$1`, [a])
check('disabled landing returns nothing', (await as(db, null, `select public.school_landing('dojo-a') l`)).rows[0].l === null)
const photoX = await tryAs(db, O2, `insert into public.school_photos (school_id, path) values ($1,'x')`, [a])
check("another owner cannot add photos to my landing", !photoX.ok, photoX.err)
const badColor = await tryAs(db, O1, `update public.schools set landing_primary='red' where id=$1`, [a])
check('custom colors must be hex', !badColor.ok, badColor.err)
report()
