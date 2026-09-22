'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type FormState = { errors?: { email?: string[]; password?: string[] }; message?: string } | undefined

export async function login(state: FormState, formData: FormData): Promise<FormState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email) return { errors: { email: ['Informe o e-mail.'] } }
  if (!password) return { errors: { password: ['Informe a senha.'] } }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { message: 'E-mail ou senha incorretos.' }
  }

  redirect('/app')
}
