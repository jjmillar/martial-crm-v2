import { describe, expect, it } from 'vitest'
import { FAQS, TUTORIALS, helpFor, richParts } from './content'
import { modules } from '../registry'

// Routes the help may link to: every module path plus the detail routes that exist in app/app.
const known = new Set(['/app', ...modules.map((m) => `/app/${m.path}`)])
const pathOf = (to: string) => to.split(/[?#]/)[0]

describe('help content', () => {
  it('has unique ids and non-empty, short steps', () => {
    const ids = TUTORIALS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of TUTORIALS) {
      expect(t.steps.length).toBeGreaterThanOrEqual(2)
      expect(t.steps.length).toBeLessThanOrEqual(6)
      for (const s of t.steps) expect(s.trim().length).toBeGreaterThan(10)
    }
  })

  it('links only to real menus of the app', () => {
    for (const t of TUTORIALS) if (t.more) expect(known.has(pathOf(t.more.to)), `${t.id} → ${t.more.to}`).toBe(true)
  })

  it('starts with the first tutorial, which replays the guided tour', () => {
    expect(TUTORIALS[0].id).toBe('primeros-pasos')
    expect(TUTORIALS[0].tour).toBe(true)
  })

  it('covers each big section for the team, and the student portal', () => {
    const team = helpFor('admin').tutorials.map((t) => t.id)
    expect(team).toEqual(expect.arrayContaining(['primeros-pasos', 'alumnos', 'equipo', 'asistencia', 'qr', 'pagos', 'planes', 'landing', 'escuela']))
    const student = helpFor('alumno').tutorials.map((t) => t.id)
    expect(student).toEqual(expect.arrayContaining(['alumno-asistencia', 'alumno-pagos', 'alumno-perfil', 'alumno-hijos']))
  })

  it('filters by role: students never see team help and vice versa', () => {
    const s = helpFor('alumno')
    expect(s.tutorials.every((t) => t.audience === 'alumno')).toBe(true)
    expect(s.faqs.every((f) => f.audience === 'alumno' || f.audience === 'todos')).toBe(true)
    expect(helpFor('ceo').tutorials.some((t) => t.audience === 'alumno')).toBe(false)
  })

  it('narrows owner-only help (subscription) to the CEO, and the setup tour to whoever can set up', () => {
    expect(helpFor('ceo').tutorials.some((t) => t.id === 'suscripcion')).toBe(true)
    expect(helpFor('admin').tutorials.some((t) => t.id === 'suscripcion')).toBe(false)
    expect(helpFor('user').tutorials.some((t) => t.id === 'primeros-pasos')).toBe(false)
    expect(helpFor(null).tutorials).toEqual([])
  })

  it('every FAQ has a question and an answer', () => {
    for (const f of FAQS) {
      expect(f.q.trim().endsWith('?')).toBe(true)
      expect(f.a.trim().length).toBeGreaterThan(20)
    }
  })

  it('richParts marks **UI names** in bold', () => {
    expect(richParts('Toca **Nueva clase** y guarda')).toEqual([
      { text: 'Toca ', strong: false }, { text: 'Nueva clase', strong: true }, { text: ' y guarda', strong: false },
    ])
  })
})
