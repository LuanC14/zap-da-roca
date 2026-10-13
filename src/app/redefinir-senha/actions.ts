'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type NewPasswordState = { error?: string } | undefined

export async function updatePassword(_state: NewPasswordState, formData: FormData): Promise<NewPasswordState> {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm_password') ?? '')

  if (password.length < 8) return { error: 'A senha deve ter ao menos 8 caracteres.' }
  if (password !== confirm) return { error: 'As senhas não coincidem.' }

  // Only reachable with the session the e-mail link created
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar?erro=link')

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    if (error.code === 'same_password') return { error: 'A nova senha deve ser diferente da atual.' }
    if (error.code === 'weak_password') return { error: 'Senha fraca. Use uma combinação mais difícil de adivinhar.' }
    console.error('updateUser(password) failed:', error.code ?? error.message)
    return { error: 'Não foi possível alterar a senha. Solicite um novo link e tente novamente.' }
  }

  // A reset usually means the old password may be compromised: end every other session
  await supabase.auth.signOut({ scope: 'others' })

  redirect('/app')
}
