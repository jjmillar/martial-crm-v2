import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// The landing page must render even before the env vars are set (e.g. a fresh Netlify site),
// so a missing config is reported in the UI instead of crashing the whole app at import time.
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const configError = 'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY (o las VITE_) en .env'

if (!supabaseConfigured) console.error(configError)

export const supabase = createClient<Database>(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'missing-anon-key',
)
