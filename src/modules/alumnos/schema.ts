import { z } from 'zod'
import { formatRut, normalizeRut } from '../../lib/rut'
import type { Student, StudentInsert } from '../../lib/database.types'

// Form state is all strings (inputs); the schema turns it into a DB row.
export type StudentForm = {
  first_name: string
  middle_name: string
  first_last_name: string
  second_last_name: string
  rut: string
  gender: '' | 'masculino' | 'femenino' | 'otro'
  birth_date: string
  enrollment_date: string
  email: string
  phone: string
  address: string
  belt: string
  belt_degree: string
  weight_kg: string
  emergency_contact: string
  emergency_phone: string
  medical_notes: string
  notes: string
  active: boolean
}

export const emptyForm = (today: string): StudentForm => ({
  first_name: '', middle_name: '', first_last_name: '', second_last_name: '', rut: '', gender: '',
  birth_date: '', enrollment_date: today, email: '', phone: '', address: '', belt: '', belt_degree: '',
  weight_kg: '', emergency_contact: '', emergency_phone: '', medical_notes: '', notes: '', active: true,
})

export const formFromStudent = (s: Student): StudentForm => ({
  first_name: s.first_name, middle_name: s.middle_name ?? '', first_last_name: s.first_last_name,
  second_last_name: s.second_last_name ?? '', rut: formatRut(s.rut), gender: s.gender ?? '', birth_date: s.birth_date ?? '',
  enrollment_date: s.enrollment_date, email: s.email ?? '', phone: s.phone ?? '', address: s.address ?? '',
  belt: s.belt ?? '', belt_degree: s.belt_degree?.toString() ?? '', weight_kg: s.weight_kg?.toString().replace('.', ',') ?? '',
  emergency_contact: s.emergency_contact ?? '', emergency_phone: s.emergency_phone ?? '',
  medical_notes: s.medical_notes ?? '', notes: s.notes ?? '', active: s.active,
})

const text = z.string().trim()
const optional = text.transform((v) => (v === '' ? null : v))
const optionalNumber = (min: number, max: number, msg: string) =>
  text.transform((v, ctx) => {
    if (v === '') return null
    const n = Number(v.replace(',', '.'))
    if (!Number.isFinite(n) || n < min || n > max) {
      ctx.addIssue({ code: 'custom', message: msg })
      return z.NEVER
    }
    return n
  })

export const studentSchema = z
  .object({
    first_name: text.min(1, 'Escribe el primer nombre.'),
    middle_name: optional,
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
    gender: z.enum(['', 'masculino', 'femenino', 'otro']).transform((v) => (v === '' ? null : v)),
    birth_date: optional,
    enrollment_date: text.min(1, 'Indica la fecha de inscripción.'),
    email: text.refine((v) => v === '' || /^\S+@\S+\.\S+$/.test(v), 'Correo inválido.').transform((v) => (v === '' ? null : v.toLowerCase())),
    phone: optional,
    address: optional,
    belt: optional,
    belt_degree: optionalNumber(0, 12, 'El grado va de 0 a 12.').refine((v) => v === null || Number.isInteger(v), 'El grado debe ser un número entero.'),
    weight_kg: optionalNumber(1, 399, 'Peso inválido.'),
    emergency_contact: optional,
    emergency_phone: optional,
    medical_notes: optional,
    notes: optional,
    active: z.boolean(),
  })
  .refine((v) => !v.birth_date || v.birth_date <= v.enrollment_date, { message: 'La fecha de nacimiento no puede ser posterior a la inscripción.', path: ['birth_date'] })

export type StudentPayload = Omit<StudentInsert, 'school_id'>

export function parseStudent(form: StudentForm): { ok: true; data: StudentPayload } | { ok: false; errors: Partial<Record<keyof StudentForm, string>> } {
  const r = studentSchema.safeParse(form)
  if (r.success) return { ok: true, data: r.data }
  const errors: Partial<Record<keyof StudentForm, string>> = {}
  for (const issue of r.error.issues) {
    const k = issue.path[0] as keyof StudentForm
    errors[k] ??= issue.message
  }
  return { ok: false, errors }
}
