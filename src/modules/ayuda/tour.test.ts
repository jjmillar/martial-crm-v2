import { beforeEach, describe, expect, it } from 'vitest'
import { TOUR_ORDER, nextStep, readTour, shouldAutoStart, startTour, stepDone, tourKey, writeTour, type TourCounts } from './tour'

const none: TourCounts = { schools: 0, classes: 0, teachers: 0, plans: 0 }

describe('tour order', () => {
  it('is the minimum to set up a school, in the order the user asked', () => {
    expect(TOUR_ORDER).toEqual(['intro', 'escuela', 'clase', 'profesor', 'plan', 'fin'])
  })
  it('moves forward one step and stops at the end', () => {
    expect(nextStep('intro')).toBe('escuela')
    expect(nextStep('plan')).toBe('fin')
    expect(nextStep('fin')).toBe('fin')
  })
})

describe('stepDone (real data, never a click)', () => {
  it('needs a school, a class, a teacher', () => {
    expect(stepDone('escuela', none)).toBe(false)
    expect(stepDone('escuela', { ...none, schools: 1 })).toBe(true)
    expect(stepDone('clase', { ...none, schools: 1, classes: 1 })).toBe(true)
    expect(stepDone('profesor', { ...none, schools: 1, teachers: 0 })).toBe(false)
    expect(stepDone('profesor', { ...none, schools: 1, teachers: 2 })).toBe(true)
    expect(stepDone('plan', { ...none, schools: 1, plans: 1 })).toBe(true)
  })
  it('is not done while counts are still loading', () => {
    expect(stepDone('clase', { ...none, schools: 1, classes: null })).toBe(false)
  })
  it('intro and fin are informational', () => {
    expect(stepDone('intro', none)).toBe(true)
    expect(stepDone('fin', none)).toBe(true)
  })
})

describe('shouldAutoStart', () => {
  it('starts for a brand-new CEO (no schools, nothing saved)', () => {
    expect(shouldAutoStart({ role: 'ceo', loading: false, schools: 0, saved: null })).toBe(true)
  })
  it('never for other roles, while loading, with schools or once saved', () => {
    expect(shouldAutoStart({ role: 'admin', loading: false, schools: 0, saved: null })).toBe(false)
    expect(shouldAutoStart({ role: 'alumno', loading: false, schools: 0, saved: null })).toBe(false)
    expect(shouldAutoStart({ role: 'ceo', loading: true, schools: 0, saved: null })).toBe(false)
    expect(shouldAutoStart({ role: 'ceo', loading: false, schools: 1, saved: null })).toBe(false)
    expect(shouldAutoStart({ role: 'ceo', loading: false, schools: 0, saved: { status: 'skipped', step: 'intro' } })).toBe(false)
  })
})

describe('storage', () => {
  beforeEach(() => localStorage.clear())
  it('is keyed by user and version, so a shared browser keeps accounts apart', () => {
    expect(tourKey('u1')).toBe('mcrm.tour:v1:u1')
    writeTour('u1', { status: 'skipped', step: 'clase' })
    expect(readTour('u1')).toEqual({ status: 'skipped', step: 'clase' })
    expect(readTour('u2')).toBeNull()
  })
  it('ignores broken or foreign values', () => {
    localStorage.setItem(tourKey('u1'), '{nope')
    expect(readTour('u1')).toBeNull()
    localStorage.setItem(tourKey('u1'), JSON.stringify({ status: 'x', step: 'y' }))
    expect(readTour('u1')).toBeNull()
  })
  it('startTour replays from the intro', () => {
    writeTour('u1', { status: 'done', step: 'fin' })
    startTour('u1')
    expect(readTour('u1')).toEqual({ status: 'active', step: 'intro' })
  })
})
