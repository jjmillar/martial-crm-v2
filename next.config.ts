import type { NextConfig } from 'next'

// Supabase keys: the public (anon) pair. They also accept the old VITE_ names, so Netlify and .env files
// keep working without renaming anything.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? 'https://hjeholicsijqurubuntv.supabase.co'
const supabaseWs = supabaseUrl.replace(/^https:/, 'wss:')

// Security headers (OWASP Secure Headers / ASVS 5.0 V3, see docs/security.md). CSP: Next.js inlines its bootstrap
// scripts, so scripts allow 'unsafe-inline' but never 'unsafe-eval' or other hosts; data only goes to our Supabase
// project (plus the OpenStreetMap geocoder for the school's own address); nothing may frame the app (clickjacking).
// Geolocation only for our own pages (QR check-in checks the student is at the school).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${supabaseUrl}`,
  `connect-src 'self' ${supabaseUrl} ${supabaseWs} https://nominatim.openstreetmap.org`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '',
  },
}

export default nextConfig
