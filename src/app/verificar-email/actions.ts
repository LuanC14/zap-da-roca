'use server'

import { createClient } from '@/lib/supabase/server'

export async function resendCode(email: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    return { success: false, message: 'Não foi possível reenviar. Tente em alguns instantes.' }
  }

  return { success: true, message: 'E-mail reenviado. Verifique sua caixa de entrada.' }
}
