import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Check } from 'lucide-react'
import { createSubscription } from './actions'

export default async function AssinarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/entrar')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, farm_name, subscription_status, trial_ends_at')
    .eq('id', user.id)
    .single()

  const trialActive = profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date()
  const daysLeft = profile?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(profile.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded bg-primary/15 flex items-center justify-center">
              <span className="text-primary text-xs font-bold font-heading">ZR</span>
            </div>
            <span className="font-heading font-bold text-lg text-foreground">Zap da Roça</span>
          </div>

          {trialActive ? (
            <>
              <h1 className="font-heading text-2xl font-bold text-foreground">Assinar para continuar</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Seu trial termina em <span className="text-amber-400 font-medium">{daysLeft} dia{daysLeft !== 1 ? 's' : ''}</span>
              </p>
            </>
          ) : (
            <>
              <h1 className="font-heading text-2xl font-bold text-foreground">Reativar acesso</h1>
              <p className="text-sm text-muted-foreground mt-1">Assine para voltar a usar o Zap da Roça</p>
            </>
          )}
        </div>

        <div className="bg-card border-2 border-primary/30 rounded-xl p-6 mb-6">
          <div className="text-center mb-5">
            <div className="font-heading text-3xl font-bold text-foreground tabular">
              R$ 29<span className="text-xl text-muted-foreground">,90</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">por mês · cancele quando quiser</div>
          </div>
          <ul className="space-y-2.5 text-sm mb-6">
            {[
              'Bot WhatsApp ilimitado',
              'Painel web completo',
              'Funcionários e relatórios',
              'Lembrete diário às 8h',
              'Suporte via WhatsApp',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>

          <form action={createSubscription}>
            <input type="hidden" name="user_id" value={user.id} />
            <input type="hidden" name="email" value={user.email} />
            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground font-medium rounded-md py-3 text-sm hover:bg-primary/90 transition-colors"
            >
              Assinar com Mercado Pago
            </button>
          </form>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Pagamento seguro via Mercado Pago · PIX ou cartão
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Olá, <span className="text-foreground">{profile?.full_name || user.email}</span>
          {profile?.farm_name ? ` · ${profile.farm_name}` : ''}
        </p>
      </div>
    </div>
  )
}
