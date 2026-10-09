'use server'

import { redirect } from 'next/navigation'
import { MercadoPagoConfig, PreApproval } from 'mercadopago'
import { createClient } from '@/lib/supabase/server'

export async function createSubscription() {
  // Identity comes from the session, never from form fields (server actions are public endpoints)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/entrar')

  const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN!,
  })

  const preApproval = new PreApproval(client)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const sub = await preApproval.create({
    body: {
      reason: 'Zap da Roça — Assinatura Mensal',
      external_reference: user.id,
      payer_email: process.env.MP_TEST_PAYER_EMAIL ?? user.email,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 29.90,
        currency_id: 'BRL',
      },
      back_url: `${appUrl}/assinar/sucesso`,
      status: 'pending',
    },
  })

  if (!sub.init_point) {
    throw new Error('Mercado Pago did not return an init_point')
  }

  redirect(sub.init_point)
}
