'use server'

import { redirect } from 'next/navigation'
import { MercadoPagoConfig, PreApproval } from 'mercadopago'

export async function createSubscription(formData: FormData) {
  const userId = formData.get('user_id') as string
  const email = formData.get('email') as string

  const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN!,
  })

  const preApproval = new PreApproval(client)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const sub = await preApproval.create({
    body: {
      reason: 'Zap da Roça — Assinatura Mensal',
      external_reference: userId,
      payer_email: email,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 29.90,
        currency_id: 'BRL',
        free_trial: {
          frequency: 7,
          frequency_type: 'days',
        },
      },
      back_url: `${appUrl}/app`,
      status: 'pending',
    },
  })

  if (!sub.init_point) {
    throw new Error('Mercado Pago did not return an init_point')
  }

  redirect(sub.init_point)
}
