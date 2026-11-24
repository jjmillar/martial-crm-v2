// Términos y condiciones: each user sees and records only their own acceptance; anon gets nothing; no edits.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const ANA = await newUser(db, 'ana'), BEN = await newUser(db, 'ben')
const V = (await db.query(`select public.current_terms_version() v`)).rows[0].v

check('anon cannot accept', !(await tryAs(db, null, `select public.accept_terms($1)`, [V])).ok)
check('anon cannot read the version function', !(await tryAs(db, null, `select public.current_terms_version()`)).ok)
check('anon cannot read acceptances', !(await tryAs(db, null, `select count(*) from public.terms_acceptances`)).ok)
check('an outdated version is refused', !(await tryAs(db, ANA, `select public.accept_terms('2000-01-01')`)).ok)
const a = await tryAs(db, ANA, `select public.accept_terms($1)`, [V])
check('a user accepts the current version', a.ok, a.err)
check('accepting twice is harmless', (await tryAs(db, ANA, `select public.accept_terms($1)`, [V])).ok)
check('one row, stamped with the user and context', (await db.query(`select count(*)::int c from public.terms_acceptances where user_id=$1 and version=$2 and context='invitacion'`, [ANA, V])).rows[0].c === 1)
check('the user sees their own acceptance', (await as(db, ANA, `select count(*)::int c from public.terms_acceptances`)).rows[0].c === 1)
check('another user does not see it', (await as(db, BEN, `select count(*)::int c from public.terms_acceptances`)).rows[0].c === 0)
check('no direct inserts (cannot fake someone else)', !(await tryAs(db, BEN, `insert into public.terms_acceptances (user_id, version, context) values ($1,$2,'ceo')`, [ANA, V])).ok)
check('no direct inserts for oneself either', !(await tryAs(db, BEN, `insert into public.terms_acceptances (user_id, version, context) values ($1,$2,'ceo')`, [BEN, V])).ok)
check('cannot edit it', !(await tryAs(db, ANA, `update public.terms_acceptances set accepted_at = now() - interval '1 year'`)).ok)
check('cannot delete it', !(await tryAs(db, ANA, `delete from public.terms_acceptances`)).ok)
await db.query(`delete from auth.users where id=$1`, [ANA])
check('deleting the account removes it', (await db.query(`select count(*)::int c from public.terms_acceptances`)).rows[0].c === 0)
report()
