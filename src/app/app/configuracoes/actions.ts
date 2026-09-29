'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { MercadoPagoConfig, PreApproval } from 'mercadopago'

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) return `55${digits}`           // DDD + número
  if (digits.length === 13 && digits.startsWith('55')) return digits
  return null
}

export async function sendPhoneVerification(
  formData: FormData
): Promise<{ error?: string; sent?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const raw = formData.get('phone') as string
  const phone = normalizePhone(raw)
  if (!phone) return { error: 'Número inválido. Use o formato: (11) 99999-9999' }

  // Block if number is already registered to another user
  const { data: existing } = await supabaseAdmin
    .from('registered_phones')
    .select('user_id')
    .eq('whatsapp_number', phone)
    .maybeSingle()

  if (existing && existing.user_id !== user.id) {
    return { error: 'Este número já está vinculado a outra conta.' }
  }

  const code = String(Math.floor(100000 + Math.random() * 900000))

  await supabaseAdmin.from('phone_verifications').insert({
    phone,
    code,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })

  try {
    await sendWhatsAppMessage(
      phone,
      `🌾 *Zap da Roça* — Código de verificação:\n\n*${code}*\n\nVálido por 10 minutos. Não compartilhe.`
    )
  } catch {
    return { error: 'Não foi possível enviar o código. Verifique o número e tente novamente.' }
  }

  return { sent: true }
}

export async function verifyPhoneCode(
  formData: FormData
): Promise<{ error?: string; verified?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const raw = formData.get('phone') as string
  const code = (formData.get('code') as string).trim()
  const phone = normalizePhone(raw)
  if (!phone) return { error: 'Número inválido.' }

  const { data: verification } = await supabaseAdmin
    .from('phone_verifications')
    .select('id, code, expires_at, used')
    .eq('phone', phone)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!verification) return { error: 'Código expirado ou inválido. Solicite um novo.' }
  if (verification.code !== code) return { error: 'Código incorreto.' }

  await supabaseAdmin
    .from('phone_verifications')
    .update({ used: true })
    .eq('id', verification.id)

  await supabaseAdmin
    .from('registered_phones')
    .upsert(
      { user_id: user.id, whatsapp_number: phone, verified: true },
      { onConflict: 'whatsapp_number' }
    )

  revalidatePath('/app/configuracoes')
  return { verified: true }
}

export async function unlinkPhone(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const { error } = await supabaseAdmin
    .from('registered_phones')
    .delete()
    .eq('user_id', user.id)

  if (error) return { error: 'Não foi possível desvincular. Tente novamente.' }

  revalidatePath('/app/configuracoes')
  return {}
}

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
