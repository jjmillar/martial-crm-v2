// T2b checks: profile email mirror and the service-only user lookup.
import { boot, newUser, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const A = await newUser(db, 'ana')

check('profile copies email on signup', (await db.query(`select email from public.profiles where id=$1`, [A])).rows[0]?.email === 'ana@test.cl')
await db.query(`update auth.users set email='ana.nueva@test.cl' where id=$1`, [A])
check('profile email follows auth email changes', (await db.query(`select email from public.profiles where id=$1`, [A])).rows[0]?.email === 'ana.nueva@test.cl')

check('lookup finds a user case-insensitively', (await db.query(`select public.find_user_id_by_email(' ANA.NUEVA@test.cl ') id`)).rows[0].id === A)
check('lookup returns null for unknown email', (await db.query(`select public.find_user_id_by_email('nadie@test.cl') id`)).rows[0].id === null)
const asUser = await tryAs(db, A, `select public.find_user_id_by_email('ana.nueva@test.cl')`)
check('authenticated cannot call the lookup', !asUser.ok, asUser.err)
const asAnon = await tryAs(db, null, `select public.find_user_id_by_email('ana.nueva@test.cl')`)
check('anon cannot call the lookup', !asAnon.ok, asAnon.err)

report()
