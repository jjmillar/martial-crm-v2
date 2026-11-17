/**
 * Supabase Edge Function: account-signup (public, no JWT)
 * Two public sign-up flows (Auth sign-up itself stays disabled):
 *  - kind "ceo"    (main site /registro): a customer creates a CEO account and can then create their schools.
 *  - kind "alumno" (a school's landing /e/<slug>/registro): a student account tied to THAT school, pending
 *                  until the school's CEO approves it in "Pendientes".
 */

import { clientIp, serveWithCors } from '../_shared/cors.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

serveWithCors(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Datos inválidos' }, 400)
    }
    const kind = body.kind === 'ceo' ? 'ceo' : body.kind === 'alumno' ? 'alumno' : ''
    const slug = str(body.school_slug, 60)
    const first = str(body.first_name, 60)
    const last = str(body.first_last_name, 60)
    const rut = str(body.rut, 20).replace(/[.\s]/g, '')
    const email = str(body.email, 200).toLowerCase()
    const phone = str(body.phone, 30)
    const password = typeof body.password === 'string' ? body.password : ''
    const middle = str(body.middle_name, 60)
    const last2 = str(body.second_last_name, 60)
    const birth = str(body.birth_date, 10)
    const address = str(body.address, 200)

    if (!kind) return json({ error: 'Tipo de cuenta inválido.' }, 400)
    if (kind === 'alumno' && !slug) return json({ error: 'Falta la escuela.' }, 400)
    if (!first || !last) return json({ error: 'Completa nombre y apellido.' }, 400)
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Correo inválido.' }, 400)
    if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400)
    if (kind === 'alumno' && !rut) return json({ error: 'Escribe tu RUT.' }, 400)
    if (kind === 'alumno') {
      if (!last2) return json({ error: 'Escribe tu segundo apellido.' }, 400)
      const today = new Date().toISOString().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || birth < '1900-01-01' || birth > today) return json({ error: 'Fecha de nacimiento inválida.' }, 400)
      if (!address) return json({ error: 'Escribe tu dirección.' }, 400)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SERVICE) {
      console.error('Missing environment variables')
      return json({ error: 'Error inesperado' }, 500)
    }
    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
    // At most 5 sign-ups per hour from the same connection (bots, account spam).
    const { data: allowed } = await admin.rpc('rate_limit_hit', { p_bucket: 'signup', p_key: clientIp(req), p_max: 5, p_window_seconds: 3600 })
    if (allowed === false) return json({ error: 'Demasiados registros desde tu conexión. Intenta de nuevo en un rato.' }, 429)

    let schoolId: string | null = null
    if (kind === 'alumno') {
      const { data: landing } = await admin.rpc('school_landing', { p_slug: slug })
      schoolId = (landing as { id?: string } | null)?.id ?? null
      if (!schoolId) return json({ error: 'Esta escuela no tiene el registro disponible.' }, 404)
    }
    if (rut) {
      const { data: rutOk } = await admin.rpc('rut_is_valid', { p_rut: rut })
      if (!rutOk) return json({ error: 'RUT inválido.' }, 400)
    }
    const { data: existing } = await admin.rpc('find_user_id_by_email', { p_email: email })
    if (existing) return json({ error: 'Ese correo ya tiene una cuenta. Inicia sesión.' }, 409)

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: [first, middle, last, last2].filter(Boolean).join(' ') },
    })
    if (createError || !created?.user) {
      console.error('Create user error:', createError)
      const weak = createError?.message?.toLowerCase().includes('password')
      return json({ error: weak ? 'La contraseña es muy débil: usa más caracteres, letras y números.' : 'No se pudo crear la cuenta.' }, 400)
    }
    const userId = created.user.id

    const { error: regError } = kind === 'ceo'
      ? await admin.rpc('register_owner', { p_user_id: userId })
      : await admin.rpc('register_account_request', {
        p_school_id: schoolId!, p_user_id: userId, p_kind: 'alumno',
        p_first_name: first, p_first_last_name: last, p_rut: rut || null, p_email: email, p_phone: phone || null,
        p_middle_name: middle || null, p_second_last_name: last2, p_birth_date: birth, p_address: address,
      })
    if (regError) {
      console.error('Register error:', regError)
      await admin.auth.admin.deleteUser(userId) // don't leave an orphan account
      return json({ error: 'No se pudo completar el registro.' }, 500)
    }
    if (phone) await admin.from('profiles').update({ phone }).eq('id', userId)
    return json({ ok: true, kind })
  } catch (err) {
    console.error('Unexpected error in account-signup:', err)
    return json({ error: 'Error inesperado' }, 500)
  }
})
