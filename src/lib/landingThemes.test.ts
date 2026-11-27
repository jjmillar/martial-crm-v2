import { describe, expect, it } from 'vitest'
import { onColor } from './landingThemes'

describe('onColor', () => {
  it('picks the text with the higher WCAG contrast', () => {
    expect(onColor('#ffffff')).toBe('#111111')
    expect(onColor('#000000')).toBe('#ffffff')
    expect(onColor('#1e4fd8')).toBe('#ffffff') // deep blue
    expect(onColor('#e0492c')).toBe('#111111') // the default red: white would be 4.07:1
    expect(onColor('#e8c547')).toBe('#111111')
  })
})
