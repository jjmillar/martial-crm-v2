// Minimal Supabase-like Postgres in PGlite: auth schema stub, anon/authenticated roles, migrations applied in order.
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export async function boot(repo) {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claims', true)::jsonb->>'role' $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on all functions in schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  `)
  const dir = join(repo, 'supabase', 'migrations')
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    try { await db.exec(readFileSync(join(dir, f), 'utf8')) } catch (e) { throw new Error(`migration ${f}: ${e.message}`) }
  }
  return db
}

let n = 0
export const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`

export async function newUser(db, name) {
  const id = uid()
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `${name}@test.cl`, { full_name: name }])
  return id
}

// Run fn's SQL as a given user (or anon when id is null) inside a transaction that is rolled back if it throws.
export async function as(db, id, sql, params = []) {
  const role = id ? 'authenticated' : 'anon'
  await db.exec(`reset role`)
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: id ?? '', role })])
  await db.exec(`set role ${role}`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role`) }
}

export async function tryAs(db, id, sql, params = []) {
  try { const r = await as(db, id, sql, params); return { ok: true, rows: r.rows, affected: r.affectedRows } } catch (e) { return { ok: false, err: e.message } }
}

const results = []
export function check(name, cond, detail = '') { results.push([cond ? 'PASS' : 'FAIL', name, detail]); }
export function report() {
  for (const [s, n, d] of results) console.log(s, n, d ? `| ${typeof d === 'string' ? d : JSON.stringify(d)}` : '')
  const f = results.filter(r => r[0] === 'FAIL').length
  console.log(`\n${results.length - f}/${results.length} passed`)
  process.exitCode = f ? 1 : 0
}
