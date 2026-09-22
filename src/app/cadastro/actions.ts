'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type FormState = {
  errors?: {
    full_name?: string[]
    email?: string[]
    password?: string[]
    confirm_password?: string[]
  }
  message?: string
} | undefined

export async function register(state: FormState, formData: FormData): Promise<FormState> {
  const full_name = (formData.get('full_name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const confirm_password = formData.get('confirm_password') as string

  const errors: NonNullable<NonNullable<FormState>['errors']> = {}
  if (!full_name || full_name.length < 2) errors.full_name = ['Nome deve ter ao menos 2 caracteres.']
  if (!email) errors.email = ['Informe o e-mail.']
  if (!password || password.length < 8) errors.password = ['Senha deve ter ao menos 8 caracteres.']
  if (password !== confirm_password) errors.confirm_password = ['As senhas não coincidem.']

  if (Object.keys(errors).length > 0) return { errors }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { errors: { email: ['Este e-mail já está cadastrado.'] } }
    }
    return { message: 'Erro ao criar conta. Tente novamente.' }
  }

  redirect(`/verificar-email?email=${encodeURIComponent(email)}`)
}
