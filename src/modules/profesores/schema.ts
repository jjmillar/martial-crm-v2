import { z } from 'zod'
import { formatRut, normalizeRut } from '../../lib/rut'
import type { TeacherWithSpecialties, TeacherPayload } from './api'

export type TeacherForm = {
  first_name: string
  first_last_name: string
  second_last_name: string
  rut: string
  email: string
  phone: string
  belt: string
  belt_degree: string
  bio: string
  user_id: string
  active: boolean
}

export const emptyTeacher: TeacherForm = {
  first_name: '', first_last_name: '', second_last_name: '', rut: '', email: '', phone: '',
  belt: '', belt_degree: '', bio: '', user_id: '', active: true,
}

export const formFromTeacher = (t: TeacherWithSpecialties): TeacherForm => ({
  first_name: t.first_name, first_last_name: t.first_last_name, second_last_name: t.second_last_name ?? '',
  rut: formatRut(t.rut), email: t.email ?? '', phone: t.phone ?? '', belt: t.belt ?? '',
  belt_degree: t.belt_degree?.toString() ?? '', bio: t.bio ?? '', user_id: t.user_id ?? '', active: t.active,
})

const text = z.string().trim()
const optional = text.transform((v) => (v === '' ? null : v))

const schema = z.object({
  first_name: text.min(1, 'Escribe el nombre.'),
  first_last_name: text.min(1, 'Escribe el primer apellido.'),
  second_last_name: optional,
  rut: text.transform((v, ctx) => {
    if (v === '') return null
    const r = normalizeRut(v)
    if (!r) {
      ctx.addIssue({ code: 'custom', message: 'RUT inválido: revisa el dígito verificador.' })
      return z.NEVER
    }
    return r
  }),
  email: text.refine((v) => v === '' || /^\S+@\S+\.\S+$/.test(v), 'Correo inválido.').transform((v) => (v === '' ? null : v.toLowerCase())),
  phone: optional,
  belt: optional,
  belt_degree: text.transform((v, ctx) => {
    if (v === '') return null
    const n = Number(v)
    if (!Number.isInteger(n) || n < 0 || n > 12) {
      ctx.addIssue({ code: 'custom', message: 'El grado va de 0 a 12.' })
      return z.NEVER
    }
    return n
  }),
  bio: text.max(600, 'Máximo 600 caracteres.').transform((v) => (v === '' ? null : v)),
  user_id: optional,
  active: z.boolean(),
})

export function parseTeacher(form: TeacherForm): { ok: true; data: TeacherPayload } | { ok: false; errors: Partial<Record<keyof TeacherForm, string>> } {
  const r = schema.safeParse(form)
  if (r.success) return { ok: true, data: r.data }
  const errors: Partial<Record<keyof TeacherForm, string>> = {}
  for (const issue of r.error.issues) errors[issue.path[0] as keyof TeacherForm] ??= issue.message
  return { ok: false, errors }
}
