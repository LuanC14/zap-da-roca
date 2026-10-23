import { describe, expect, it } from 'vitest'
import { brazilPhoneVariants } from './phone'

describe('brazilPhoneVariants', () => {
  it('adds the form without the ninth digit for a 13-digit mobile number', () => {
    expect(brazilPhoneVariants('5571988887777')).toEqual(['5571988887777', '557188887777'])
  })

  it('adds the form with the ninth digit for a 12-digit mobile number', () => {
    expect(brazilPhoneVariants('557188887777')).toEqual(['557188887777', '5571988887777'])
  })

  it('is symmetric: either form finds the other', () => {
    const a = new Set(brazilPhoneVariants('5511988887777'))
    const b = new Set(brazilPhoneVariants('551188887777'))
    expect([...a].sort()).toEqual([...b].sort())
  })

  it('does not invent a mobile form for landlines', () => {
    expect(brazilPhoneVariants('557433221100')).toEqual(['557433221100'])
  })

  it('leaves non-Brazilian or malformed numbers alone', () => {
    expect(brazilPhoneVariants('14155550123')).toEqual(['14155550123'])
    expect(brazilPhoneVariants('')).toEqual([''])
  })

  it('ignores formatting characters', () => {
    expect(brazilPhoneVariants('+55 (71) 98888-7777')).toContain('557188887777')
  })
})
