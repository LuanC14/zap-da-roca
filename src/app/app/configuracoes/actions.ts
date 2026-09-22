'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MercadoPagoConfig, PreApproval } from 'mercadopago'

export async function cancelSubscription(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_id')
    .eq('id', user.id)
    .single()

  if (profile?.subscription_id) {
    try {
      const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
      const preApproval = new PreApproval(mp)
      await preApproval.update({ id: profile.subscription_id, body: { status: 'cancelled' } })
    } catch {
      // Continue to update locally even if MP call fails
    }
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ subscription_status: 'cancelled' })
    .eq('id', user.id)

  if (error) return { error: 'Não foi possível cancelar. Tente novamente.' }

  revalidatePath('/app/configuracoes')
  return {}
}
