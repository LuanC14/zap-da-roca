import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasAccess } from '@/lib/access'

// For server actions that write tenant data: they are public POST endpoints, so the page-level
// gate in the layout is not enough. Returns the RLS-scoped client for the signed-in tenant.
export async function requireTenant() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at, current_period_end, is_admin')
    .eq('id', user.id)
    .single()

  if (!hasAccess(profile)) redirect('/assinar')

  return { supabase, user }
}
