// Migration 20261127000006: the landing's price list (active paid plans only, readable by anyone).
import { boot, newUser, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
await db.query(`insert into public.platform_plans (name, price_clp, period, active) values ('Viejo', 9990, 'mensual', false), ('Anual', 200000, 'anual', true)`)
const anon = await tryAs(db, null, `select * from public.public_plans()`)
check('anon reads the price list', anon.ok, anon.err)
const names = (anon.rows ?? []).map((r) => r.name)
check('only active paid plans', !names.includes('Cortesía') && !names.includes('Viejo') && names.includes('Anual'), names)
check('cheapest first', (anon.rows ?? []).every((r, i, a) => i === 0 || a[i - 1].price_clp <= r.price_clp), anon.rows)
check('only price-list columns', Object.keys(anon.rows?.[0] ?? {}).sort().join() === 'id,max_schools,max_students,name,period,price_clp')
check('anon still cannot read the plans table', !(await tryAs(db, null, `select * from public.platform_plans`)).ok)
const u = await newUser(db, 'x')
check('a signed-in user reads it too', (await tryAs(db, u, `select * from public.public_plans()`)).ok)
report()
