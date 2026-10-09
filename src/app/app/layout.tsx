import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasAccess } from '@/lib/access'
import { Sidebar } from '@/components/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at, current_period_end, is_admin')
    .eq('id', user.id)
    .single()

  if (!hasAccess(profile)) redirect('/assinar')

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto min-w-0 bg-dot-grid">{children}</main>
    </div>
  )
}
