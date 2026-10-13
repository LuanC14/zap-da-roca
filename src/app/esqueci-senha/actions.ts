'use server'

import { createClient } from '@/lib/supabase/server'

export type ResetRequestState = { error?: string; sent?: boolean } | undefined

export async function requestPasswordReset(_state: ResetRequestState, formData: FormData): Promise<ResetRequestState> {
  const email = String(formData.get('email') ?? '').trim()
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Informe um e-mail válido.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/redefinir-senha`,
  })

  if (error) {
    console.error('resetPasswordForEmail failed:', error.code ?? error.message)
    if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
      return { error: 'Muitas solicitações. Aguarde alguns minutos e tente novamente.' }
    }
    return { error: 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.' }
  }

  // Same answer whether or not the address has an account (no account enumeration)
  return { sent: true }
}
