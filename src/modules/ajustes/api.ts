import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

export type EmailLogRow = Database['public']['Tables']['email_log']['Row']

export async function listEmailLog(schoolId: string): Promise<EmailLogRow[]> {
  const { data, error } = await supabase
    .from('email_log')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data
}

/** Calls the send-email Edge Function. Template names map to entries in supabase/functions/send-email. */
export async function sendTemplate(template: string, schoolId: string): Promise<{ sent: number }> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; sent: number }>('send-email', { body: { template, school_id: schoolId } })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const body = ctx ? await ctx.json().catch(() => null) : null
    throw new Error(body?.error ?? 'No se pudo enviar el correo.')
  }
  return { sent: data?.sent ?? 0 }
}
