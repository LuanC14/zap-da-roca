import { describe, expect, it } from 'vitest'
import { hasAccess, trialDaysLeft } from './access'

const NOW = new Date('2026-10-08T12:00:00Z')
const future = '2026-10-15T12:00:00Z'
const past = '2026-10-01T12:00:00Z'

describe('hasAccess', () => {
  it('denies a missing profile', () => {
    expect(hasAccess(null)).toBe(false)
    expect(hasAccess(undefined)).toBe(false)
  })

  it('admins always have access, even with an expired trial (proxy used to lock them out)', () => {
    expect(hasAccess({ is_admin: true, subscription_status: 'trial', trial_ends_at: past }, NOW)).toBe(true)
    expect(hasAccess({ is_admin: true, subscription_status: 'cancelled' }, NOW)).toBe(true)
  })

  it('trial is valid only until trial_ends_at', () => {
    expect(hasAccess({ subscription_status: 'trial', trial_ends_at: future }, NOW)).toBe(true)
    expect(hasAccess({ subscription_status: 'trial', trial_ends_at: past }, NOW)).toBe(false)
    expect(hasAccess({ subscription_status: 'trial', trial_ends_at: null }, NOW)).toBe(false)
  })

  it('active subscriptions have access regardless of the old trial date', () => {
    expect(hasAccess({ subscription_status: 'active', trial_ends_at: past }, NOW)).toBe(true)
  })

  it('a cancelled plan stays usable until the paid period ends', () => {
    expect(hasAccess({ subscription_status: 'cancelled', current_period_end: future }, NOW)).toBe(true)
    expect(hasAccess({ subscription_status: 'cancelled', current_period_end: past }, NOW)).toBe(false)
    expect(hasAccess({ subscription_status: 'cancelled', current_period_end: null }, NOW)).toBe(false)
  })

  it('paused / past_due / unknown statuses are denied', () => {
    for (const status of ['paused', 'past_due', 'whatever']) {
      expect(hasAccess({ subscription_status: status, trial_ends_at: future, current_period_end: future }, NOW)).toBe(false)
    }
  })

  it('treats a null status as trial', () => {
    expect(hasAccess({ subscription_status: null, trial_ends_at: future }, NOW)).toBe(true)
  })
})

describe('trialDaysLeft', () => {
  it('rounds up and never goes negative', () => {
    expect(trialDaysLeft({ trial_ends_at: future }, NOW)).toBe(7)
    expect(trialDaysLeft({ trial_ends_at: past }, NOW)).toBe(0)
    expect(trialDaysLeft(null, NOW)).toBe(0)
  })
})
