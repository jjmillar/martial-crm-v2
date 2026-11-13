import type { NextConfig } from 'next'

// Supabase keys: the public (anon) pair. They also accept the old VITE_ names, so Netlify and .env files
// keep working without renaming anything.
const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '',
  },
}

export default nextConfig
