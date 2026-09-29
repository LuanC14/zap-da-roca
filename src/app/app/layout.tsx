import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at')
    .eq('id', user.id)
    .single()

  const status = profile?.subscription_status ?? 'trial'
  const trialActive = status === 'trial' && !!profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date()
  const hasAccess = trialActive || status === 'active' || status === 'payment_in_process'

  if (!hasAccess) redirect('/assinar')

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto min-w-0 bg-dot-grid">{children}</main>
    </div>
  )
}
