'use server'

import { randomInt } from 'node:crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendVerificationCode } from '@/lib/whatsapp'
import { safeEqual } from '@/lib/security'
import { requireTenant } from '@/lib/tenant'
import { brazilPhoneVariants } from '@/lib/phone'
import { matchKey } from '@/lib/parsers/text'
import { MercadoPagoConfig, PreApproval } from 'mercadopago'

const OTP_TTL_MS = 10 * 60 * 1000
const MAX_CODES_PER_USER_PER_HOUR = 5
const MAX_CODES_PER_PHONE_PER_HOUR = 3
const MAX_VERIFY_ATTEMPTS = 5

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
    .in('whatsapp_number', brazilPhoneVariants(phone))

  if (existing?.some((row) => row.user_id !== user.id)) {
    return { error: 'Este número já está vinculado a outra conta.' }
  }

  // Each code is a business-initiated WhatsApp message: cap how many a user / number can trigger
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const [{ count: byUser }, { count: byPhone }] = await Promise.all([
    supabaseAdmin
      .from('phone_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since),
    supabaseAdmin
      .from('phone_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .gte('created_at', since),
  ])

  if ((byUser ?? 0) >= MAX_CODES_PER_USER_PER_HOUR || (byPhone ?? 0) >= MAX_CODES_PER_PHONE_PER_HOUR) {
    return { error: 'Muitas solicitações de código. Tente novamente em 1 hora.' }
  }

  const code = String(randomInt(100000, 1000000))

  const { error: insertError } = await supabaseAdmin.from('phone_verifications').insert({
    user_id: user.id,
    phone,
    code,
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  })
  if (insertError) return { error: 'Não foi possível gerar o código. Tente novamente.' }

  try {
    await sendVerificationCode(phone, code)
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
  const code = ((formData.get('code') as string) ?? '').trim()
  const phone = normalizePhone(raw)
  if (!phone) return { error: 'Número inválido.' }

  const { data: verification } = await supabaseAdmin
    .from('phone_verifications')
    .select('id, code, attempts')
    .eq('phone', phone)
    .eq('user_id', user.id)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!verification) return { error: 'Código expirado ou inválido. Solicite um novo.' }

  if (verification.attempts >= MAX_VERIFY_ATTEMPTS) {
    await supabaseAdmin.from('phone_verifications').update({ used: true }).eq('id', verification.id)
    return { error: 'Muitas tentativas incorretas. Solicite um novo código.' }
  }

  if (!safeEqual(String(verification.code).trim(), code)) {
    await supabaseAdmin
      .from('phone_verifications')
      .update({ attempts: verification.attempts + 1 })
      .eq('id', verification.id)
    return { error: 'Código incorreto.' }
  }

  await supabaseAdmin
    .from('phone_verifications')
    .update({ used: true })
    .eq('id', verification.id)

  // Never take over a number another tenant linked in the meantime
  const { data: owners } = await supabaseAdmin
    .from('registered_phones')
    .select('user_id')
    .in('whatsapp_number', brazilPhoneVariants(phone))

  if (owners?.some((row) => row.user_id !== user.id)) {
    return { error: 'Este número já está vinculado a outra conta.' }
  }

  // One WhatsApp number per account: replace any previously linked number
  await supabaseAdmin
    .from('registered_phones')
    .delete()
    .eq('user_id', user.id)
    .neq('whatsapp_number', phone)

  const { error } = await supabaseAdmin
    .from('registered_phones')
    .upsert(
      { user_id: user.id, whatsapp_number: phone, verified: true },
      { onConflict: 'whatsapp_number' }
    )
  if (error) return { error: 'Não foi possível vincular o número. Tente novamente.' }

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

  // If Mercado Pago can't cancel, don't mark it cancelled locally: the customer would keep being charged
  if (profile?.subscription_id) {
    try {
      const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
      const preApproval = new PreApproval(mp)
      await preApproval.update({ id: profile.subscription_id, body: { status: 'cancelled' } })
    } catch (err) {
      console.error('cancelSubscription: Mercado Pago call failed', err)
      return { error: 'Não foi possível cancelar no Mercado Pago. Tente novamente em instantes.' }
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

// ── Custom categories ────────────────────────────────────────────────────────

export async function createCategory(formData: FormData): Promise<{ error?: string; ok?: true }> {
  const { supabase, user } = await requireTenant()

  const name = String(formData.get('name') ?? '').trim().replace(/\s+/g, ' ')
  const type = String(formData.get('type') ?? '')
  if (name.length < 2 || name.length > 40) return { error: 'Informe o nome (2 a 40 caracteres).' }
  if (type !== 'expense' && type !== 'income' && type !== 'both') return { error: 'Escolha o tipo da categoria.' }

  // RLS exposes global + own categories: block names the bot could not tell apart
  const { data: visible } = await supabase
    .from('categories')
    .select('name')
    .or(`user_id.eq.${user.id},user_id.is.null`)
  if ((visible ?? []).some((c) => matchKey(c.name) === matchKey(name))) {
    return { error: 'Já existe uma categoria com esse nome.' }
  }

  const { error } = await supabase.from('categories').insert({ user_id: user.id, name, type })
  if (error) return { error: 'Não foi possível criar a categoria. Tente novamente.' }

  revalidatePath('/app/configuracoes')
  return { ok: true }
}

export async function deleteCategory(id: string): Promise<{ error?: string; ok?: true }> {
  const { supabase, user } = await requireTenant()

  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')

  // 23503: transactions still reference it
  if (error?.code === '23503') return { error: 'Categoria em uso por lançamentos e não pode ser removida.' }
  if (error) return { error: 'Não foi possível remover a categoria. Tente novamente.' }
  if (!data?.length) return { error: 'Categoria não encontrada (as categorias padrão não podem ser removidas).' }

  revalidatePath('/app/configuracoes')
  return { ok: true }
}
