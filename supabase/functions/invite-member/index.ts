/**
 * Supabase Edge Function: invite-member
 * Invites a new user by email or assigns/updates role in a school for an existing user.
 * Requires caller to be an admin of the specified school.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  try {
    type Body = { school_id?: unknown; email?: unknown; role?: unknown; full_name?: unknown }
    let body: Body
    try {
      body = (await req.json()) as Body
    } catch {
      return json({ error: 'Datos inválidos' }, 400)
    }

    const { school_id, email, role } = body ?? {}
    const full_name = typeof body?.full_name === 'string' && body.full_name.trim() ? body.full_name.trim() : undefined

    if (
      typeof school_id !== 'string' ||
      !school_id.trim() ||
      typeof email !== 'string' ||
      !email.includes('@') ||
      (role !== 'admin' && role !== 'user')
    ) {
      return json({ error: 'Datos inválidos' }, 400)
    }

    const normalizedEmail = email.trim().toLowerCase()

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables')
      return json({ error: 'Error inesperado' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await caller.auth.getUser()
    if (userError || !userData?.user) {
      return json({ error: 'No autenticado' }, 401)
    }

    const { data: hasRole, error: roleError } = await caller.rpc('has_school_role', {
      p_school_id: school_id,
      p_roles: ['admin'],
    })

    if (roleError || !hasRole) {
      return json({ error: 'No tienes permiso para invitar en esta escuela' }, 403)
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const { data: existingUserId, error: findError } = await admin.rpc('find_user_id_by_email', {
      p_email: normalizedEmail,
    })

    // A lookup failure must not fall through to sending a second invitation.
    if (findError) {
      console.error('Lookup error:', findError)
      return json({ error: 'Error inesperado' }, 500)
    }

    let userId: string
    let invited = false

    if (!existingUserId) {
      const siteUrl = Deno.env.get('SITE_URL') ?? ''
      const redirectTo = siteUrl ? `${siteUrl}/bienvenida` : undefined

      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        normalizedEmail,
        {
          data: full_name ? { full_name } : undefined,
          ...(redirectTo ? { redirectTo } : {}),
        }
      )

      if (inviteError || !inviteData?.user) {
        console.error('Invite error:', inviteError)
        return json({ error: 'No se pudo enviar la invitación' }, 500)
      }

      userId = inviteData.user.id
      invited = true
    } else {
      userId = existingUserId
      invited = false
    }

    const { error: upsertError } = await admin
      .from('school_members')
      .upsert(
        { school_id, user_id: userId, role },
        { onConflict: 'school_id,user_id' }
      )

    if (upsertError) {
      console.error('Upsert membership error:', upsertError)
      if (upsertError.message && upsertError.message.includes('at least one admin')) {
        return json({ error: 'La escuela debe mantener al menos un administrador' }, 409)
      }
      return json({ error: 'No se pudo asignar el rol' }, 500)
    }

    return json({ ok: true, user_id: userId, invited })
  } catch (err) {
    console.error('Unexpected error in invite-member function:', err)
    return json({ error: 'Error inesperado' }, 500)
  }
})
