'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type VerifyState = { message?: string } | undefined

export async function verifyEmail(state: VerifyState, formData: FormData): Promise<VerifyState> {
  const email = (formData.get('email') as string)?.trim()
  const token = (formData.get('token') as string)?.trim()

  if (!token || token.length !== 6) {
    return { message: 'Digite o código de 6 dígitos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })

  if (error) {
    if (error.message.toLowerCase().includes('expired')) {
      return { message: 'Código expirado. Solicite um novo.' }
    }
    return { message: 'Código inválido. Verifique e tente novamente.' }
  }

  redirect('/app')
}

export async function resendCode(email: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.resend({ type: 'signup', email })

  if (error) {
    return { success: false, message: 'Não foi possível reenviar. Tente em alguns instantes.' }
  }

  return { success: true, message: 'Novo código enviado para o seu e-mail.' }
}
