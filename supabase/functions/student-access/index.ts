/**
 * Supabase Edge Function: student-access (card items 6 + 7)
 * Gives a student a login for the student portal, or removes it.
 *  - link:   if an account with that email exists (e.g. the student is also a member), links it as-is;
 *            otherwise creates the account with the password the admin set (no email needed, so it works
 *            before the school has a verified sending domain).
 *  - unlink: removes the link; the account itself is kept (it may be a staff member too).
 * Requires the caller to be an admin of the student's school.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    type Body = { student_id?: unknown; action?: unknown; email?: unknown; password?: unknown }
    let body: Body
    try {
      body = (await req.json()) as Body
    } catch {
      return json({ error: 'Datos inválidos' }, 400)
    }
    const { student_id, action } = body ?? {}
    if (typeof student_id !== 'string' || (action !== 'link' && action !== 'unlink')) return json({ error: 'Datos inválidos' }, 400)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables')
      return json({ error: 'Error inesperado' }, 500)
    }

    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: userData, error: userError } = await caller.auth.getUser()
    if (userError || !userData?.user) return json({ error: 'No autenticado' }, 401)

    // Read the student as the caller: RLS already limits it to their schools.
    const { data: student } = await caller.from('students').select('id, school_id, full_name, email, user_id').eq('id', student_id).maybeSingle()
    if (!student) return json({ error: 'Alumno no encontrado' }, 404)
    const { data: isAdmin } = await caller.rpc('has_school_role', { p_school_id: student.school_id, p_roles: ['admin'] })
    if (!isAdmin) return json({ error: 'Solo los administradores gestionan el acceso de alumnos' }, 403)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

    if (action === 'unlink') {
      const { error } = await admin.from('students').update({ user_id: null }).eq('id', student.id)
      if (error) {
        console.error('Unlink error:', error)
        return json({ error: 'No se pudo quitar el acceso' }, 500)
      }
      return json({ ok: true })
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Correo inválido' }, 400)

    const { data: existingId, error: findError } = await admin.rpc('find_user_id_by_email', { p_email: email })
    if (findError) {
      console.error('Lookup error:', findError)
      return json({ error: 'Error inesperado' }, 500)
    }

    let userId = existingId as string | null
    let created = false
    if (!userId) {
      const password = typeof body.password === 'string' ? body.password : ''
      if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: student.full_name },
      })
      if (error || !data?.user) {
        console.error('Create user error:', error)
        const weak = error?.message?.toLowerCase().includes('weak') || error?.message?.toLowerCase().includes('password')
        return json({ error: weak ? 'La contraseña es muy débil: usa más caracteres, letras y números' : 'No se pudo crear la cuenta' }, 400)
      }
      userId = data.user.id
      created = true
    }

    const patch: { user_id: string; email?: string } = { user_id: userId }
    if (!student.email) patch.email = email
    const { error: linkError } = await admin.from('students').update(patch).eq('id', student.id)
    if (linkError) {
      console.error('Link error:', linkError)
      if (linkError.message.includes('students_school_user_key')) return json({ error: 'Esa cuenta ya está vinculada a otro alumno de esta escuela' }, 409)
      return json({ error: 'No se pudo vincular la cuenta' }, 500)
    }
    return json({ ok: true, created, user_id: userId })
  } catch (err) {
    console.error('Unexpected error in student-access:', err)
    return json({ error: 'Error inesperado' }, 500)
  }
})
