/**
 * Supabase Edge Function: account-signup (public, no JWT)
 * Open sign-up on the site: the person says what the account is for (student or staff member) and which
 * school. Auth sign-up stays disabled; this function creates the account and files a request that the CEO
 * (or the school's admins) approve in "Pendientes". Nothing is granted until then.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Datos inválidos' }, 400)
    }
    const kind = body.kind === 'miembro' ? 'miembro' : body.kind === 'alumno' ? 'alumno' : ''
    const schoolId = str(body.school_id, 40)
    const first = str(body.first_name, 60)
    const last = str(body.first_last_name, 60)
    const rut = str(body.rut, 20).replace(/[.\s]/g, '')
    const email = str(body.email, 200).toLowerCase()
    const phone = str(body.phone, 30)
    const password = typeof body.password === 'string' ? body.password : ''

    if (!kind) return json({ error: 'Elige para qué es la cuenta.' }, 400)
    if (!schoolId) return json({ error: 'Elige tu escuela.' }, 400)
    if (!first || !last) return json({ error: 'Completa nombre y apellido.' }, 400)
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Correo inválido.' }, 400)
    if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400)
    if (kind === 'alumno' && !rut) return json({ error: 'Escribe tu RUT.' }, 400)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SERVICE) {
      console.error('Missing environment variables')
      return json({ error: 'Error inesperado' }, 500)
    }
    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

    if (rut) {
      const { data: rutOk } = await admin.rpc('rut_is_valid', { p_rut: rut })
      if (!rutOk) return json({ error: 'RUT inválido.' }, 400)
    }
    const { data: existing } = await admin.rpc('find_user_id_by_email', { p_email: email })
    if (existing) return json({ error: 'Ese correo ya tiene una cuenta. Inicia sesión.' }, 409)

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: `${first} ${last}` },
    })
    if (createError || !created?.user) {
      console.error('Create user error:', createError)
      const weak = createError?.message?.toLowerCase().includes('password')
      return json({ error: weak ? 'La contraseña es muy débil: usa más caracteres, letras y números.' : 'No se pudo crear la cuenta.' }, 400)
    }

    const { error: regError } = await admin.rpc('register_account_request', {
      p_school_id: schoolId, p_user_id: created.user.id, p_kind: kind,
      p_first_name: first, p_first_last_name: last, p_rut: rut || null, p_email: email, p_phone: phone || null,
    })
    if (regError) {
      console.error('Register error:', regError)
      await admin.auth.admin.deleteUser(created.user.id) // don't leave an orphan account
      return json({ error: regError.message.includes('school not found') ? 'Esa escuela no existe.' : 'No se pudo registrar la solicitud.' }, 400)
    }
    if (phone) await admin.from('profiles').update({ phone }).eq('id', created.user.id)
    return json({ ok: true })
  } catch (err) {
    console.error('Unexpected error in account-signup:', err)
    return json({ error: 'Error inesperado' }, 500)
  }
})
