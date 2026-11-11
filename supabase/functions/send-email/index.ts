/**
 * Edge Function: send-email (S12)
 * One entry point for app emails. Each template declares who may send it, who receives it and what it says;
 * add payment receipts, announcements, etc. as new entries in `templates`.
 * Every attempt is written to public.email_log.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { layout, sendEmail } from '../_shared/email.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Ctx = {
  caller: SupabaseClient
  admin: SupabaseClient
  user: { id: string; email: string }
  schoolId: string | null
  schoolName: string | null
  siteUrl: string
}
type Rendered = { to: string; subject: string; html: string; text: string }
type Template = {
  /** Return an error message (Spanish) when the caller may not send this template. */
  authorize: (ctx: Ctx) => Promise<string | null>
  build: (ctx: Ctx) => Promise<Rendered[]>
}

async function isSchoolAdmin(ctx: Ctx): Promise<boolean> {
  if (!ctx.schoolId) return false
  const { data } = await ctx.caller.rpc('has_school_role', { p_school_id: ctx.schoolId, p_roles: ['admin'] })
  return data === true
}
async function isCeo(ctx: Ctx): Promise<boolean> {
  const { data } = await ctx.caller.rpc('is_ceo')
  return data === true
}

const templates: Record<string, Template> = {
  // Sends a sample to the caller's own address: confirms Resend, sender and layout end to end.
  test: {
    authorize: async (ctx) => ((await isCeo(ctx)) || (await isSchoolAdmin(ctx)) ? null : 'Solo administradores pueden enviar correos de prueba'),
    build: async (ctx) => {
      const { html, text } = layout({
        eyebrow: ctx.schoolName ?? 'Martial CRM',
        title: 'Correo de prueba',
        paragraphs: [
          'Si estás leyendo esto, los correos de Martial CRM funcionan.',
          'Por este mismo canal saldrán los avisos de pagos, recordatorios e informativos de tu academia.',
        ],
        cta: { label: 'Abrir Martial CRM', url: `${ctx.siteUrl}/app` },
        footnote: 'Lo enviaste tú desde Ajustes → Correos.',
      })
      return [{ to: ctx.user.email, subject: 'Prueba de correo · Martial CRM', html, text }]
    },
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const body = (await req.json().catch(() => null)) as { template?: unknown; school_id?: unknown } | null
    const name = typeof body?.template === 'string' ? body.template : ''
    const template = Object.hasOwn(templates, name) ? templates[name] : undefined
    const schoolId = typeof body?.school_id === 'string' && body.school_id ? body.school_id : null
    if (!template) return json({ error: 'Plantilla desconocida' }, 400)

    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: u } = await caller.auth.getUser()
    if (!u?.user?.email) return json({ error: 'No autenticado' }, 401)
    const admin = createClient(url, service, { auth: { persistSession: false } })

    let schoolName: string | null = null
    if (schoolId) {
      const { data: school } = await caller.from('schools').select('name').eq('id', schoolId).maybeSingle()
      if (!school) return json({ error: 'Escuela no encontrada' }, 404)
      schoolName = school.name
    }

    const ctx: Ctx = { caller, admin, user: { id: u.user.id, email: u.user.email }, schoolId, schoolName, siteUrl: Deno.env.get('SITE_URL') ?? '' }
    const denied = await template.authorize(ctx)
    if (denied) return json({ error: denied }, 403)

    const messages = await template.build(ctx)
    const results = []
    for (const m of messages) {
      const r = await sendEmail({ ...m, tags: { template: name } })
      await admin.from('email_log').insert({
        school_id: schoolId,
        template: name,
        to_email: m.to,
        subject: m.subject,
        status: r.ok ? 'sent' : 'failed',
        provider_id: r.ok ? r.id : null,
        error: r.ok ? null : r.error,
        created_by: ctx.user.id,
      })
      if (!r.ok) console.error('send failed', name, r.error)
      results.push({ to: m.to, ok: r.ok })
    }
    const failed = results.filter((r) => !r.ok).length
    if (failed === results.length) return json({ error: 'No se pudo enviar el correo', results }, 502)
    return json({ ok: true, sent: results.length - failed, failed, results })
  } catch (err) {
    console.error('send-email unexpected', err)
    return json({ error: 'Error inesperado' }, 500)
  }
})
