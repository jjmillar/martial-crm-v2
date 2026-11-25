import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: string[] = []
vi.mock('./api', () => ({
  addFromTemplate: vi.fn(async (_s: string, key: string) => { calls.push(`add:${key}`); return 'new' }),
  createArt: vi.fn(async (_s: string, name: string, pos: number) => { calls.push(`create:${name}@${pos}`) }),
  updateArt: vi.fn(async (id: string, patch: { active?: boolean }) => { calls.push(`${patch.active ? 'on' : 'off'}:${id}`) }),
}))

const { applyPicks, initialPicks, picksOk, ARTS_REQUIRED } = await import('./picks')
type Art = Parameters<typeof initialPicks>[0][number]
const art = (id: string, name: string, key: string | null, active = true): Art => ({ id, school_id: 's', name, template_key: key, position: 0, active, belts: [] })
const templates = [{ key: 'bjj', name: 'Jiu-jitsu brasileño', position: 1 }, { key: 'judo', name: 'Judo', position: 2 }]

beforeEach(() => { calls.length = 0 })

describe('art picks', () => {
  it('lists the school arts (as saved) and the catalog arts it does not have yet', () => {
    const picks = initialPicks([art('a1', 'Jiu-jitsu brasileño', 'bjj'), art('a2', 'Kickboxing', null, false)], templates)
    expect(picks.map((p) => [p.name, p.on])).toEqual([['Jiu-jitsu brasileño', true], ['Kickboxing', false], ['Judo', false]])
  })

  it('requires at least one art', async () => {
    const picks = initialPicks([], templates)
    expect(picksOk(picks)).toBe(false)
    await expect(applyPicks('s', picks, [])).rejects.toThrow(ARTS_REQUIRED)
    expect(calls).toEqual([])
  })

  it('adds catalog and own arts, turns on before turning off (never zero active arts midway)', async () => {
    const arts = [art('a1', 'Jiu-jitsu brasileño', 'bjj'), art('a2', 'Kickboxing', null, false)]
    const picks = initialPicks(arts, templates).map((p) => ({ ...p, on: p.name !== 'Jiu-jitsu brasileño' }))
    picks.push({ id: 'new:muay thai', name: 'Muay Thai', on: true })
    await applyPicks('s', picks, arts)
    expect(calls).toEqual(['on:a2', 'add:judo', 'create:Muay Thai@2', 'off:a1'])
  })

  it('touches nothing that did not change', async () => {
    const arts = [art('a1', 'Jiu-jitsu brasileño', 'bjj')]
    await applyPicks('s', initialPicks(arts, templates), arts)
    expect(calls).toEqual([])
  })
})
