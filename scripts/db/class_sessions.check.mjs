// Every class that takes place is a record (class_sessions): correlative number in date order, snapshot of the class,
// history frozen, edits from the class reach today on, edits from the card stay in that session, XP by session skills.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const O = await newUser(db, 'dueno'), U = await newUser(db, 'staff'), O2 = await newUser(db, 'otro')
await db.query(`select set_config('request.jwt.claims', '{}', false)`)
await db.query(`select public.register_owner($1), public.register_owner($2)`, [O, O2])
const s = (await as(db, O, `select (public.create_school('Dojo','dojo-s')).id`)).rows[0].id
const s2 = (await as(db, O2, `select (public.create_school('Otro','dojo-o')).id`)).rows[0].id
await as(db, O, `insert into public.school_members (school_id, user_id, role) values ($1,$2,'user')`, [s, U])
const today = (await db.query(`select (now() at time zone 'America/Santiago')::date d`)).rows[0].d.toISOString().slice(0, 10)
const q1 = async (who, sql, p) => (await as(db, who, sql, p)).rows

const g1 = (await q1(O, `insert into public.tags (school_id, label) values ($1,'Guardia') returning id`, [s]))[0].id
const g2 = (await q1(O, `insert into public.tags (school_id, label) values ($1,'Derribos') returning id`, [s]))[0].id
// A class that runs every day at 07:00 and 19:00, created 10 days ago.
const cls = (await q1(O, `insert into public.classes (school_id, name, description) values ($1,'BJJ','Base') returning id`, [s]))[0].id
await db.query(`update public.classes set created_at = now() - interval '10 days' where id=$1`, [cls])
const days = [1, 2, 3, 4, 5, 6, 7].map((w) => `{"weekday":${w},"start_time":"07:00","end_time":"08:00"},{"weekday":${w},"start_time":"19:00","end_time":"20:00"}`).join(',')
await as(db, O, `select public.set_class_details($1, array[$2]::uuid[], $3::jsonb)`, [cls, g1, `[${days}]`])

check('nothing is stored before the first sync', (await q1(O, `select count(*)::int c from public.class_sessions`))[0].c === 0)
const synced = await tryAs(db, U, `select public.sync_class_sessions($1) n`, [s])
check('staff can sync (opening Asistencia)', synced.ok, synced.err)
let rows = await q1(U, `select number, date::text d, start_time::text t, name, description, skill_ids from public.class_sessions order by number`)
check('every class up to today is a record (11 days × 2)', rows.length === 22, rows.length)
check('numbers are correlative in date and time order', rows.every((r, i) => r.number === i + 1) && rows.every((r, i) => i === 0 || r.d > rows[i - 1].d || (r.d === rows[i - 1].d && r.t > rows[i - 1].t)), rows.map((r) => `${r.number}:${r.d} ${r.t}`).slice(0, 4))
check('each record keeps the class data and skills', rows[0].name === 'BJJ' && rows[0].description === 'Base' && rows[0].skill_ids.length === 1 && rows[0].skill_ids[0] === g1)
check('no future sessions are created', rows.every((r) => r.d <= today))
check('sync is idempotent', (await q1(U, `select public.sync_class_sessions($1) n`, [s]))[0].n === 0 && (await q1(U, `select count(*)::int c from public.class_sessions`))[0].c === 22)

// Editing the class: today on changes, the past stays.
await as(db, O, `update public.classes set name='BJJ Gi', description='Nueva' where id=$1`, [cls])
rows = await q1(U, `select date::text d, name, description from public.class_sessions order by number`)
check('editing the class updates today', rows.filter((r) => r.d === today).every((r) => r.name === 'BJJ Gi' && r.description === 'Nueva'))
check('editing the class keeps past sessions (history)', rows.filter((r) => r.d < today).every((r) => r.name === 'BJJ' && r.description === 'Base'))
await as(db, O, `select public.set_class_details($1, array[$2,$3]::uuid[], $4::jsonb)`, [cls, g1, g2, `[${days}]`])
rows = await q1(U, `select date::text d, skill_ids from public.class_sessions order by number`)
check('class skills reach today, not the past', rows.filter((r) => r.d === today).every((r) => r.skill_ids.length === 2) && rows.filter((r) => r.d < today).every((r) => r.skill_ids.length === 1))

// Editing a card (one session)
const past = (await q1(U, `select id, date::text d, start_time::text t from public.class_sessions where date < $1 order by number limit 1`, [today]))[0]
const saved = await tryAs(db, O, `select public.save_class_session($1, $2, $3, 'Solo ese día', array[$4]::uuid[])`, [cls, past.d, past.t, g2])
check('admin edits one session from its card', saved.ok && saved.rows[0].save_class_session === past.id, saved.err)
const one = (await q1(U, `select description, skill_ids, customized from public.class_sessions where id=$1`, [past.id]))[0]
check('only that session changed', one.description === 'Solo ese día' && one.skill_ids.length === 1 && one.skill_ids[0] === g2 && one.customized)
check('other sessions untouched', (await q1(U, `select count(*)::int c from public.class_sessions where description='Solo ese día'`))[0].c === 1)
const tomorrow = (await db.query(`select ((now() at time zone 'America/Santiago')::date + 1)::text d`)).rows[0].d
const fut = await tryAs(db, O, `select public.save_class_session($1, $2, '19:00', 'Clase especial', '{}')`, [cls, tomorrow])
check('editing a future card creates its record', fut.ok, fut.err)
const f = (await q1(U, `select number, description, customized, end_time::text e from public.class_sessions where date=$1 and start_time='19:00'`, [tomorrow]))[0]
check('a future session waits for its number', f.number === null && f.description === 'Clase especial' && f.customized && f.e === '20:00:00', f)
await as(db, O, `update public.classes set description='Otra vez' where id=$1`, [cls])
check('a session edited on its own keeps its edit when the class changes', (await q1(U, `select description from public.class_sessions where date=$1 and start_time='19:00'`, [tomorrow]))[0].description === 'Clase especial')
check('staff (user role) cannot edit sessions', !(await tryAs(db, U, `select public.save_class_session($1, $2, '19:00', 'x', '{}')`, [cls, tomorrow])).ok)
check('another owner cannot edit my sessions', !(await tryAs(db, O2, `select public.save_class_session($1, $2, '19:00', 'x', '{}')`, [cls, tomorrow])).ok)
check('skills of another school are dropped', (await tryAs(db, O, `select public.save_class_session($1, $2, '19:00', 'x', array[$3]::uuid[])`, [cls, tomorrow, (await q1(O2, `insert into public.tags (school_id, label) values ($1,'Ajena') returning id`, [s2]))[0].id])).ok &&
  (await q1(U, `select skill_ids from public.class_sessions where date=$1 and start_time='19:00'`, [tomorrow]))[0].skill_ids.length === 0)
check('no direct writes to sessions', !(await tryAs(db, O, `update public.class_sessions set number = 999 where school_id=$1`, [s])).ok || (await q1(O, `select count(*)::int c from public.class_sessions where number=999`))[0].c === 0)
check('another school cannot read my sessions', (await q1(O2, `select count(*)::int c from public.class_sessions`))[0].c === 0)
check('another owner cannot sync my school', !(await tryAs(db, O2, `select public.sync_class_sessions($1)`, [s])).ok)

// XP by the skills each session had
const st = (await q1(O, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Ana','QA') returning id`, [s]))[0].id
await as(db, O, `insert into public.attendance (school_id, class_id, student_id, date, confirmed_at) values ($1,$2,$3,$4,now())`, [s, cls, st, past.d])
await as(db, O, `insert into public.attendance (school_id, class_id, student_id, date, confirmed_at) values ($1,$2,$3,$4,now())`, [s, cls, st, today])
const prog = (await q1(O, `select public.student_progress($1) p`, [st]))[0].p
const xp = Object.fromEntries(prog.skills.map((k) => [k.label, k.xp]))
check('XP uses the skills of each session', prog.xp === 20 && xp.Derribos === 20 && xp.Guardia === 10, prog.skills)
report()
