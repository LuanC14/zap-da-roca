import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResetForm } from './reset-form'

export default async function RedefinirSenhaPage() {
  // The recovery link signs the user in through /auth/callback; without that session there is nothing to reset
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar?erro=link')

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded bg-primary/15 flex items-center justify-center">
              <span className="text-primary text-xs font-bold font-heading">ZR</span>
            </div>
            <span className="font-heading font-bold text-lg text-foreground">Zap da Roça</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Criar nova senha</h1>
          <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
        </div>

        <ResetForm />
      </div>
    </div>
  )
}
