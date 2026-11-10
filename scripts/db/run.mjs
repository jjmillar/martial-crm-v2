// Runs every scripts/db/*.check.mjs against a fresh PGlite with all migrations applied (no Docker needed).
import { readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

let failed = 0
for (const f of readdirSync('scripts/db').filter(f => f.endsWith('.check.mjs')).sort()) {
  console.log(`\n== ${f}`)
  try { execFileSync(process.execPath, [`scripts/db/${f}`], { stdio: 'inherit' }) } catch { failed++ }
}
process.exit(failed ? 1 : 0)
