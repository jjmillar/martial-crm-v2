// CORS for the Edge Functions: only the app's own origins (production, Netlify deploy previews, local dev) get
// the Access-Control-Allow-Origin header back. Browsers on any other site cannot read the responses.
const ALLOWED = [
  /^https:\/\/martialcrm-v2\.netlify\.app$/,
  /^https:\/\/[a-z0-9-]+--martialcrm-v2\.netlify\.app$/,
  /^http:\/\/localhost:\d+$/,
]
const extra = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)

export function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const ok = ALLOWED.some((r) => r.test(origin)) || extra.includes(origin)
  return {
    ...(ok ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

/** Client IP as forwarded by the Supabase gateway (first hop). */
export const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()

/** Deno.serve with the CORS allowlist: answers the preflight and adds the CORS headers to every response. */
export function serveWithCors(handler: (req: Request) => Response | Promise<Response>) {
  Deno.serve(async (req: Request) => {
    const cors = corsFor(req)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const res = await handler(req)
    const headers = new Headers(res.headers)
    for (const [k, v] of Object.entries(cors)) headers.set(k, v)
    return new Response(res.body, { status: res.status, headers })
  })
}
