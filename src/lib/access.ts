export type AccessProfile = {
  subscription_status?: string | null
  trial_ends_at?: string | null
  current_period_end?: string | null
  is_admin?: boolean | null
} | null | undefined

// Single source of truth for "may this tenant use the product?" — used by the web
// layout, the WhatsApp bot and the daily reminder cron.
export function hasAccess(profile: AccessProfile, now: Date = new Date()): boolean {
  if (!profile) return false
  if (profile.is_admin) return true

  const status = profile.subscription_status ?? 'trial'
  const isFuture = (iso?: string | null) => !!iso && new Date(iso).getTime() > now.getTime()

  switch (status) {
    case 'active':
      return true
    case 'trial':
      return isFuture(profile.trial_ends_at)
    case 'cancelled':
      // A cancelled plan stays usable until the period that was already paid ends
      return isFuture(profile.current_period_end)
    default:
      return false
  }
}

export function trialDaysLeft(profile: AccessProfile, now: Date = new Date()): number {
  if (!profile?.trial_ends_at) return 0
  const ms = new Date(profile.trial_ends_at).getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}
