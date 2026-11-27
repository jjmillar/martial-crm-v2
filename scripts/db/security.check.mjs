// Security hardening: function privileges, MFA (aal2) enforcement, bank data guard, audit log, rate limits.
import { boot, newUser, as, tryAs, check, report } from './harness.mjs'

const db = await boot(process.cwd())
const OWNER = await newUser(db, 'owner'), ADM = await newUser(db, 'adm'), STAFF = await newUser(db, 'staff')
await db.query(`insert into public.owners (user_id) values ($1)`, [OWNER])
const sc = (await as(db, OWNER, `select (public.create_school('Dojo Uno','dojo-uno')).id`)).rows[0].id
await as(db, OWNER, `insert into public.school_members (school_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'user')`, [sc, ADM, STAFF])

// 1. Function privileges
const anonCalls = ['select public.is_ceo()', `select public.is_school_member('${sc}')`, `select public.sync_class_sessions('${sc}')`, `select public.generate_enrollment_fees('${sc}')`,
  'select public.sync_all_class_sessions()', `select public.rate_limit_hit('x','y',1,60)`, `select public.audit(null,'x','y',null,'{}')`, 'select public.mfa_ok()']
for (const sql of anonCalls) {
  const r = await tryAs(db, null, sql)
  check(`anon cannot run: ${sql.slice(7, 50)}`, !r.ok && /permission denied/.test(r.err), r.err)
}
check('anon can open a landing page', (await tryAs(db, null, `select public.school_landing('dojo-uno')`)).ok)
check('anon can read a public student profile', (await tryAs(db, null, `select public.student_public_profile('dojo-uno','x')`)).ok)
const anonBook = await tryAs(db, null, `select public.book_trial('dojo-uno', gen_random_uuid(), current_date, 'a', '1', null, null)`)
check('anon can call book_trial (then its own checks apply)', !anonBook.ok && !/permission denied/.test(anonBook.err), anonBook.err)
for (const sql of [`select public.rate_limit_hit('x','y',1,60)`, `select public.audit(null,'x','y',null,'{}')`, 'select public.sync_all_class_sessions()']) {
  const r = await tryAs(db, ADM, sql)
  check(`signed-in users cannot run internal: ${sql.slice(7, 40)}`, !r.ok && /permission denied/.test(r.err), r.err)
}
check('signed-in users keep the RLS helpers', (await tryAs(db, ADM, `select public.is_school_member($1) m`, [sc])).rows?.[0]?.m === true)
const trig = (await db.query(`select count(*)::int c from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prorettype='trigger'::regtype and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)).rows[0].c
check('no trigger function is callable through the API', trig === 0, trig)
const anonAny = (await db.query(`select array_agg(p.proname order by p.proname) l from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon', p.oid, 'execute')`)).rows[0].l
check('anon executes only the public RPCs (landing, trial booking, student profile, price list)', JSON.stringify(anonAny) === JSON.stringify(['book_trial', 'public_plans', 'school_landing', 'student_public_profile']), anonAny)
await db.query(`create function public.zz_new() returns int language sql as 'select 1'`)
check('new functions are not executable by anon by default', !(await db.query(`select has_function_privilege('anon', 'public.zz_new()', 'execute') x`)).rows[0].x)

// 2. MFA: a user with a verified factor needs an aal2 session
check('without MFA an aal1 session reaches data', (await as(db, ADM, `select count(*)::int c from public.schools`)).rows[0].c === 1)
await db.query(`insert into auth.mfa_factors (user_id, status) values ($1,'verified')`, [ADM])
check('with MFA enrolled, aal1 sees nothing', (await as(db, ADM, `select count(*)::int c from public.schools`)).rows[0].c === 0)
const aal1Write = await tryAs(db, ADM, `insert into public.plans (school_id, name, price) values ($1,'X',1)`, [sc])
check('with MFA enrolled, aal1 cannot write', !aal1Write.ok)
check('with MFA enrolled, aal2 works', (await as(db, ADM, `select count(*)::int c from public.schools`, [], { aal: 'aal2' })).rows[0].c === 1)
await db.query(`insert into auth.mfa_factors (user_id, status) values ($1,'unverified')`, [STAFF])
check('an unverified factor does not lock the user out', (await as(db, STAFF, `select count(*)::int c from public.schools`)).rows[0].c === 1)

// 3. Bank data guard + 4. audit
const admChange = await tryAs(db, ADM, `update public.schools set transfer_account_number='999' where id=$1`, [sc], { aal: 'aal2' })
check('a school admin cannot change the bank data', !admChange.ok && /only the CEO/.test(admChange.err), admChange.err)
const admOther = await tryAs(db, ADM, `update public.schools set city='Santiago' where id=$1`, [sc], { aal: 'aal2' })
check('admins still edit the rest of the school', admOther.ok, admOther.err)
await as(db, OWNER, `update public.schools set transfer_bank='Banco', transfer_account_number='123' where id=$1`, [sc])
const log = (await db.query(`select actor, details from public.audit_log where action='transfer_data_changed'`)).rows
check('bank data change is audited with before/after and who', log.length === 1 && log[0].actor === OWNER && log[0].details.after.number === '123' && log[0].details.before.number === null, log)
const st = (await as(db, OWNER, `insert into public.students (school_id, first_name, first_last_name) values ($1,'Ana','Uno') returning id`, [sc])).rows[0].id
const pay = (await as(db, OWNER, `insert into public.payments (school_id, student_id, concept, amount) values ($1,$2,'Mes',1000) returning id`, [sc, st])).rows[0].id
await as(db, OWNER, `update public.payments set status='pagado' where id=$1`, [pay])
check('payment status change is audited', (await db.query(`select count(*)::int c from public.audit_log where action='payment_changed' and entity_id=$1`, [pay])).rows[0].c === 1)
await as(db, OWNER, `update public.school_members set role='admin' where user_id=$1 and school_id=$2`, [STAFF, sc])
check('role change is audited', (await db.query(`select count(*)::int c from public.audit_log where action='member_role_changed'`)).rows[0].c === 1)
check('the owner reads the audit log', (await as(db, OWNER, `select count(*)::int c from public.audit_log`)).rows[0].c >= 3)
check('admins do not read the audit log', (await as(db, ADM, `select count(*)::int c from public.audit_log`, [], { aal: 'aal2' })).rows[0].c === 0)
const forge = await tryAs(db, OWNER, `insert into public.audit_log (action, entity) values ('x','y')`)
check('nobody writes the audit log directly', !forge.ok)
const wipe = await tryAs(db, OWNER, `delete from public.audit_log`)
check('nobody deletes the audit log', !wipe.ok || wipe.affected === 0)
await db.query(`delete from public.schools where id=$1`, [sc])
check('deleting a school does not break on audit rows', (await db.query(`select count(*)::int c from public.schools`)).rows[0].c === 0)

// 5. Rate limit
const hits = []
for (let i = 0; i < 4; i++) hits.push((await db.query(`select public.rate_limit_hit('t','1.2.3.4',3,3600) ok`)).rows[0].ok)
check('rate limit allows up to the max, then blocks', JSON.stringify(hits) === '[true,true,true,false]', hits)
check('other keys are independent', (await db.query(`select public.rate_limit_hit('t','5.6.7.8',3,3600) ok`)).rows[0].ok)
check('trial bookings have a per-IP rate limit', (await db.query(`select count(*)::int c from pg_trigger where tgname='trial_bookings_rate_limit'`)).rows[0].c === 1)
report()
