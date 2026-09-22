import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, PreApproval } from 'mercadopago'
import { supabaseAdmin } from '@/lib/supabase'

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

const STATUS_MAP: Record<string, string> = {
  authorized: 'active',
  pending: 'trial',
  payment_in_process: 'active',
  cancelled: 'cancelled',
  paused: 'paused',
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.type !== 'subscription_preapproval') {
    return NextResponse.json({ status: 'ignored' })
  }

  const notificationId = String(body.id ?? '')
  const preApprovalId = (body.data as Record<string, string>)?.id

  if (!notificationId || !preApprovalId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  // Idempotency: skip if already processed
  const { data: existing } = await supabaseAdmin
    .from('payment_events')
    .select('id')
    .eq('id', notificationId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ status: 'already_processed' })
  }

  // Fetch current subscription state from MP
  const preApproval = new PreApproval(client)
  let subscription: Awaited<ReturnType<typeof preApproval.get>>

  try {
    subscription = await preApproval.get({ id: preApprovalId })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 502 })
  }

  const mpStatus = String(subscription.status ?? '')
  const internalStatus = STATUS_MAP[mpStatus] ?? 'cancelled'
  const userId = subscription.external_reference

  if (!userId) {
    return NextResponse.json({ error: 'No external_reference on subscription' }, { status: 400 })
  }

  // Update profile
  await supabaseAdmin
    .from('profiles')
    .update({
      subscription_id: preApprovalId,
      subscription_status: internalStatus,
      current_period_end: subscription.auto_recurring?.end_date ?? null,
    })
    .eq('id', userId)

  // Record event for idempotency
  await supabaseAdmin
    .from('payment_events')
    .insert({
      id: notificationId,
      user_id: userId,
      event_type: `subscription_preapproval.${mpStatus}`,
      payload: body,
    })

  return NextResponse.json({ status: 'ok' })
}
