/**
 * Supabase Edge Function: student-signup (public, no JWT)
 * A student registers through their school's link (/registro/<code>). Public sign-up stays disabled in Auth;
 * this function creates the account and then register_student_signup() either links it to the matching
 * student (RUT + email) or leaves a pending request for the school's admins.
 * Note: until a sending domain is verified there is no email confirmation; matching needs BOTH RUT and email.
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
    const code = str(body.code, 40)
    const first = str(body.first_name, 60)
    const last = str(body.first_last_name, 60)
    const rut = str(body.rut, 20)
    const email = str(body.email, 200).toLowerCase()
    const phone = str(body.phone, 30)
    const password = typeof body.password === 'string' ? body.password : ''

    if (!code || !first || !last) return json({ error: 'Completa nombre y apellido.' }, 400)
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Correo inválido.' }, 400)
    if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SERVICE) {
      console.error('Missing environment variables')
      return json({ error: 'Error inesperado' }, 500)
    }
    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

    const { data: school } = await admin.rpc('signup_school', { p_code: code })
    if (!school?.length) return json({ error: 'El link de registro no es válido o está desactivado. Pídele uno nuevo a tu escuela.' }, 404)
    const { data: rutOk } = await admin.rpc('rut_is_valid', { p_rut: rut.replace(/[.\s]/g, '') })
    if (!rutOk) return json({ error: 'RUT inválido.' }, 400)

    const { data: existing } = await admin.rpc('find_user_id_by_email', { p_email: email })
    if (existing) return json({ error: 'Ese correo ya tiene una cuenta. Inicia sesión, o pide a tu escuela que la vincule.' }, 409)

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: `${first} ${last}` },
    })
    if (createError || !created?.user) {
      console.error('Create user error:', createError)
      const weak = createError?.message?.toLowerCase().includes('password')
      return json({ error: weak ? 'La contraseña es muy débil: usa más caracteres, letras y números.' : 'No se pudo crear la cuenta.' }, 400)
    }

    const { data: result, error: regError } = await admin.rpc('register_student_signup', {
      p_code: code, p_user_id: created.user.id, p_first_name: first, p_first_last_name: last, p_rut: rut, p_email: email, p_phone: phone || null,
    })
    if (regError) {
      console.error('Register error:', regError)
      await admin.auth.admin.deleteUser(created.user.id) // don't leave an orphan account
      return json({ error: 'No se pudo registrar la solicitud.' }, 500)
    }
    return json({ ok: true, linked: Boolean((result as { linked?: boolean })?.linked), school: school[0].name })
  } catch (err) {
    console.error('Unexpected error in student-signup:', err)
    return json({ error: 'Error inesperado' }, 500)
  }
})
