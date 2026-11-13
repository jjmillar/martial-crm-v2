import { supabase } from '../../lib/supabase'
import type { Profile, SchoolRole } from '../../lib/database.types'

export type Member = { id: string; user_id: string; role: SchoolRole; profile: Pick<Profile, 'full_name' | 'email'> | null }

// school_members references auth.users, not profiles, so the two are fetched and joined here.
export async function listMembers(schoolId: string): Promise<Member[]> {
  const { data: rows, error } = await supabase.from('school_members').select('id, user_id, role').eq('school_id', schoolId)
  if (error) throw error
  const ids = rows.map((r) => r.user_id)
  const { data: profiles, error: pErr } = ids.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', ids)
    : { data: [], error: null }
  if (pErr) throw pErr
  const byId = new Map(profiles.map((p) => [p.id, p]))
  return rows
    .map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }))
    .sort((a, b) => (a.profile?.full_name ?? a.profile?.email ?? '').localeCompare(b.profile?.full_name ?? b.profile?.email ?? ''))
}

// The school's owner (CEO): shown on top of the list, display only (not a membership row).
export type Ceo = { user_id: string; full_name: string | null; email: string | null }
export async function listCeos(schoolId: string): Promise<Ceo[]> {
  const { data, error } = await supabase.rpc('school_owner', { p_school_id: schoolId })
  if (error) throw error
  return data ?? []
}

export type InviteInput = { school_id: string; email: string; role: SchoolRole; full_name?: string }

export async function inviteMember(input: InviteInput): Promise<{ invited: boolean }> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; invited: boolean; error?: string }>('invite-member', { body: input })
  if (error) {
    // FunctionsHttpError carries the JSON body with our Spanish message
    const ctx = (error as { context?: Response }).context
    const body = ctx ? await ctx.json().catch(() => null) : null
    throw new Error(body?.error ?? 'No se pudo enviar la invitación.')
  }
  return { invited: Boolean(data?.invited) }
}

export function friendlyDbError(message: string): string {
  if (message.includes('at least one admin')) return 'La escuela debe mantener al menos un administrador.'
  return 'No se pudo guardar el cambio.'
}

export async function updateRole(memberId: string, role: SchoolRole) {
  const { error } = await supabase.from('school_members').update({ role }).eq('id', memberId)
  if (error) throw new Error(friendlyDbError(error.message))
}

export async function removeMember(memberId: string) {
  const { error } = await supabase.from('school_members').delete().eq('id', memberId)
  if (error) throw new Error(friendlyDbError(error.message))
}
