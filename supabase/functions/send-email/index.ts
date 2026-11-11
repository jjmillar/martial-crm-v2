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
  /** Extra per-template parameters from the request body. */
  params: Record<string, unknown>
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

const clp = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n).replace(/s/g, '')
const methodLabel: Record<string, string> = { transferencia: 'Transferencia', efectivo: 'Efectivo', tarjeta: 'Tarjeta', otro: 'Otro' }

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
  // Receipt for a confirmed payment, sent to the student's email.
  payment_receipt: {
    authorize: async (ctx) => ((await isSchoolAdmin(ctx)) || (await isCeo(ctx)) ? null : 'Solo administradores pueden enviar comprobantes'),
    build: async (ctx) => {
      const id = typeof ctx.params.payment_id === 'string' ? ctx.params.payment_id : ''
      // Read through the caller's client so RLS confirms the payment belongs to a school they can see.
      const { data: p } = await ctx.caller
        .from('payments')
        .select('id, school_id, concept, amount, method, status, paid_at, student:students(full_name, email)')
        .eq('id', id)
        .maybeSingle()
      if (!p || p.school_id !== ctx.schoolId) throw new Error('Pago no encontrado')
      if (p.status !== 'pagado') throw new Error('Solo se envían comprobantes de pagos confirmados')
      const student = p.student as unknown as { full_name: string | null; email: string | null } | null
      if (!student?.email) throw new Error('El alumno no tiene correo registrado')
      const when = p.paid_at ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeZone: 'America/Santiago' }).format(new Date(p.paid_at)) : ''
      const { html, text } = layout({
        eyebrow: ctx.schoolName ?? 'Comprobante',
        title: `Recibimos tu pago de ${clp(p.amount)}`,
        paragraphs: [
          `Hola ${student.full_name ?? ''}, gracias por tu pago.`,
          `Concepto: ${p.concept}`,
          `Monto: ${clp(p.amount)} · Medio: ${methodLabel[p.method] ?? p.method}${when ? ` · Fecha: ${when}` : ''}`,
          `N° de comprobante: ${p.id.slice(0, 8).toUpperCase()}`,
        ],
        footnote: 'Este correo es un comprobante interno de la academia, no una boleta electrónica.',
      })
      return [{ to: student.email, subject: `Comprobante de pago · ${ctx.schoolName ?? 'Martial CRM'}`, html, text }]
    },
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const body = (await req.json().catch(() => null)) as ({ template?: unknown; school_id?: unknown } & Record<string, unknown>) | null
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

    const ctx: Ctx = { caller, admin, user: { id: u.user.id, email: u.user.email }, schoolId, schoolName, siteUrl: Deno.env.get('SITE_URL') ?? '', params: body ?? {} }
    const denied = await template.authorize(ctx)
    if (denied) return json({ error: denied }, 403)

    let messages: Rendered[]
    try {
      messages = await template.build(ctx)
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'No se pudo preparar el correo' }, 422)
    }
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
