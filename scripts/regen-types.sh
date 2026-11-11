#!/usr/bin/env bash
# Push pending migrations to the linked Supabase project and regenerate src/lib/database.generated.ts.
# Needs SUPABASE_DB_PASSWORD in the environment (kept outside the repo).
set -euo pipefail
npx supabase db push --remote --yes
npx supabase gen types --lang typescript --linked --schema public > src/lib/database.generated.ts
npx --yes prettier@3.3.3 --write src/lib/database.generated.ts > /dev/null
