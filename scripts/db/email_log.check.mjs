// T15 checks: email_log is readable by school admins and the CEO only, and writable by nobody but the service role.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const CEO = await newUser(db, 'ceo'), A = await newUser(db, 'ana'), U = await newUser(db, 'uri'), X = await newUser(db, 'xavi')
await db.query(`select public.grant_ceo('ceo@test.cl')`)
const s1 = (await as(db, CEO, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
const s2 = (await as(db, CEO, `select (public.create_school('Dojo Dos','dojo-dos')).id`)).rows[0].id
await db.query(`insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user'), ($4,$5,'admin')`, [s1, A, U, s2, X])

// service-role style writes (superuser here)
await db.query(`insert into public.email_log (school_id, template, to_email, subject, status) values ($1,'test','ana@test.cl','Prueba','sent'), ($2,'test','xavi@test.cl','Prueba','sent'), (null,'test','ceo@test.cl','Prueba','failed')`, [s1, s2])

const count = async (id) => (await as(db, id, `select count(*)::int c from public.email_log`)).rows[0].c
check('admin sees only their school log', (await count(A)) === 1)
check('user role cannot read the log', (await count(U)) === 0)
check('other school admin sees only theirs', (await count(X)) === 1)
check('CEO sees every row, including platform-level', (await count(CEO)) === 3)
check('anon sees nothing', !(await tryAs(db, null, `select * from public.email_log`)).ok || (await tryAs(db, null, `select * from public.email_log`)).rows.length === 0)

const ins = await tryAs(db, A, `insert into public.email_log (school_id, template, to_email, subject, status) values ($1,'test','x@x.cl','x','sent')`, [s1])
check('admin cannot insert log rows', !ins.ok, ins.err)
const upd = await tryAs(db, A, `update public.email_log set status='failed'`)
check('admin cannot update log rows', !upd.ok || upd.affected === 0, upd.err)
const del = await tryAs(db, CEO, `delete from public.email_log`)
check('CEO cannot delete log rows', !del.ok || del.affected === 0, del.err)
const bad = await db.query(`insert into public.email_log (template, to_email, subject, status) values ('Bad Name!','a','b','sent')`).then(() => null, (e) => e.message)
check('template name is validated', Boolean(bad), bad)

report()
