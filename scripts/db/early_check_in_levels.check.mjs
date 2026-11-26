// Migration 20261126000003: check-in opens 1 hour before the class; levels need 100 + 10·(n−1) XP each.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const lv = async (xp) => (await db.query(`select public.xp_level($1) l`, [xp])).rows[0].l
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ---- Level curve ----------------------------------------------------------------------------------------------------
check('0 XP = level 1, 0/100', eq(await lv(0), { level: 1, level_xp: 0, next_level_xp: 100 }), await lv(0))
check('99 XP = level 1, 99/100', eq(await lv(99), { level: 1, level_xp: 99, next_level_xp: 100 }))
check('100 XP = level 2, 0/110', eq(await lv(100), { level: 2, level_xp: 0, next_level_xp: 110 }))
check('209 XP = level 2, 109/110', eq(await lv(209), { level: 2, level_xp: 109, next_level_xp: 110 }))
check('210 XP = level 3, 0/120', eq(await lv(210), { level: 3, level_xp: 0, next_level_xp: 120 }))
check('330 XP = level 4, 0/130', eq(await lv(330), { level: 4, level_xp: 0, next_level_xp: 130 }))
const reach = async (n) => (await db.query(`select public.xp_to_reach($1) x`, [n])).rows[0].x
check('xp_to_reach matches the curve', (await reach(1)) === 0 && (await reach(2)) === 100 && (await reach(3)) === 210 && (await reach(4)) === 330 && (await reach(10)) === 1260)
check('xp_to_reach(n) is exactly where level n starts', (await lv(await reach(20))).level === 20 && (await lv((await reach(20)) - 1)).level === 19)
check('negative / null XP = level 1', (await lv(-5)).level === 1 && (await db.query(`select public.xp_level(null) l`)).rows[0].l.level === 1)
check('anon cannot call xp_level', !(await tryAs(db, null, `select public.xp_level(10)`)).ok)

// ---- Progress, public profile and milestones use the curve ----------------------------------------------------------
const OWNER = await newUser(db, 'owner'), ST = await newUser(db, 'alumna')
await db.query(`insert into public.owners (user_id) values ($1)`, [OWNER])
const sc = (await as(db, OWNER, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const sid = (await as(db, OWNER, `insert into public.students (school_id, first_name, first_last_name, user_id) values ($1,'Ana','Uno',$2) returning id`, [sc, ST])).rows[0].id
const cls = (await as(db, OWNER, `insert into public.classes (school_id, name) values ($1,'BJJ') returning id`, [sc])).rows[0].id
// 23 approved classes = 230 XP = level 3 with 20/120 (inserted as the system: no window check without a user).
await db.query(`insert into public.attendance (school_id, class_id, student_id, date, confirmed_at)
  select $1, $2, $3, current_date - g, now() from generate_series(1, 23) g`, [sc, cls, sid])
const pr = (await as(db, ST, `select public.student_progress($1) p`, [sid])).rows[0].p
check('student_progress: level 3, 20 / 120', pr.level === 3 && pr.level_xp === 20 && pr.next_level_xp === 120 && pr.xp === 230 && pr.attended === 23, pr)
await db.query(`update public.schools set landing_enabled = true where id = $1`, [sc])
await as(db, ST, `select public.save_my_public_profile($1,'ana-uno',true,null,null,true,true,true)`, [sid])
await db.query(`update public.student_profiles set show_achievements = true where student_id = $1`, [sid])
const pub = (await as(db, null, `select public.student_public_profile('dojo-uno','ana-uno') p`)).rows[0].p
check('public profile stats: level 3, 20 / 120', pub?.stats?.level === 3 && pub.stats.level_xp === 20 && pub.stats.next_level_xp === 120, pub?.stats)
const ms = (await db.query(`select public.student_milestones($1) m`, [sid])).rows[0].m
check('no "Nivel 5" milestone at 23 classes', !ms.some((m) => m.key === 'nivel-5'), ms.map((m) => m.key))
await db.query(`insert into public.attendance (school_id, class_id, student_id, date, confirmed_at)
  select $1, $2, $3, current_date - g, now() from generate_series(24, 46) g`, [sc, cls, sid])
const ms2 = (await db.query(`select public.student_milestones($1) m`, [sid])).rows[0].m
check('"Nivel 5" milestone at 46 classes (460 XP)', ms2.some((m) => m.key === 'nivel-5'), ms2.map((m) => m.key))
check('level 5 starts at 460 XP', (await lv(460)).level === 5 && (await lv(459)).level === 4)

// ---- Check-in opens 1 hour before --------------------------------------------------------------------------------------
const clock = (await db.query(`select extract(hour from (now() at time zone 'America/Santiago'))::int h, extract(isodow from (now() at time zone 'America/Santiago')::date)::int w`)).rows[0]
if (clock.h >= 3 && clock.h < 20) {
  const mk = async (name, fromNowMin) => {
    const c = (await as(db, OWNER, `insert into public.classes (school_id, name) values ($1,$2) returning id`, [sc, name])).rows[0].id
    await as(db, OWNER, `insert into public.class_schedules (school_id, class_id, weekday, start_time, end_time)
      values ($1,$2,$3, ((now() at time zone 'America/Santiago') + make_interval(mins => $4))::time, ((now() at time zone 'America/Santiago') + make_interval(mins => $4 + 60))::time)`,
      [sc, c, clock.w, fromNowMin])
    return c
  }
  const in40 = await mk('En 40 min', 40), in90 = await mk('En 90 min', 90)
  const ok40 = await tryAs(db, ST, `select (public.check_in($1)).id`, [in40])
  check('student checks in 40 min before the start', ok40.ok, ok40.err)
  const no90 = await tryAs(db, ST, `select public.check_in($1)`, [in90])
  check('student cannot check in 90 min before', !no90.ok && /class not started/.test(no90.err), no90.err)
  check('class_open says the same', (await as(db, ST, `select public.class_open($1, (now() at time zone 'America/Santiago')::date) a, public.class_open($2, (now() at time zone 'America/Santiago')::date) b`, [in40, in90])).rows.every((r) => r.a === true && r.b === false))
  const row = (await db.query(`select confirmed_at from public.attendance where class_id=$1 and student_id=$2`, [in40, sid])).rows[0]
  check('early check-in still waits for approval', row && row.confirmed_at === null, row)
} else {
  check('(time-dependent 1-hour checks skipped at this hour)', true)
}
check('anon cannot call class_open', !(await tryAs(db, null, `select public.class_open(gen_random_uuid(), current_date)`)).ok)

report()
