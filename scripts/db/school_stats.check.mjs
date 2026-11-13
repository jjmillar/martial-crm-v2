// Card item 2: school_stats() counts only what the caller may see.
import { boot, newUser, as, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), A = await newUser(db, 'ana')
await db.query(`select public.grant_ceo('ceo@test.cl')`)
const s1 = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const s2 = (await as(db, CEO, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin')`, [s1, A])
await as(db, A, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Ana','Uno'), ($1,'Beto','Dos')`, [s1])
await as(db, A, `insert into public.students (school_id, first_name, first_last_name, active) values ($1,'Inactivo','Tres',false)`, [s1])
await as(db, CEO, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Otro','Dojo')`, [s2])

const ceo = (await as(db, CEO, `select * from public.school_stats()`)).rows
check('CEO sees stats for every school', ceo.length === 2, ceo)
const one = ceo.find((r) => r.school_id === s1)
check('active students counted, inactive excluded', one.students_active === 2, one)
check('members counted', one.members === 1, one)
const mine = (await as(db, A, `select * from public.school_stats()`)).rows
check('admin only sees own school stats', mine.length === 1 && mine[0].school_id === s1, mine)
report()
