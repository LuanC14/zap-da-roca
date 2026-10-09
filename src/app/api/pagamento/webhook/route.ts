import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, PreApproval } from 'mercadopago'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyMercadoPagoSignature } from '@/lib/security'

const STATUS_MAP: Record<string, string> = {
  authorized: 'active',
  pending: 'trial',
  payment_in_process: 'active',
  cancelled: 'cancelled',
  paused: 'paused',
}

export async function POST(req: NextRequest) {
  const secret = process.env.MP_WEBHOOK_SECRET

  // Without the signing secret an unauthenticated caller could drive subscription changes:
  // refuse in production, allow in dev for local testing.
  if (!secret && process.env.NODE_ENV === 'production') {
    console.error('MP_WEBHOOK_SECRET is not configured — rejecting Mercado Pago webhook')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const preApprovalId = (body.data as Record<string, string> | undefined)?.id

  if (secret) {
    const valid = verifyMercadoPagoSignature({
      secret,
      xSignature: req.headers.get('x-signature'),
      xRequestId: req.headers.get('x-request-id'),
      dataId: req.nextUrl.searchParams.get('data.id') ?? preApprovalId ?? null,
    })
    if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  if (body.type !== 'subscription_preapproval') {
    return NextResponse.json({ status: 'ignored' })
  }

  const notificationId = String(body.id ?? '')

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
  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
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

  // Keep the previous period end when MP omits it (e.g. on cancellation) so a paid period stays usable
  const nextPayment = subscription.next_payment_date
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_id: preApprovalId,
      subscription_status: internalStatus,
      ...(nextPayment && internalStatus !== 'cancelled' ? { current_period_end: nextPayment } : {}),
    })
    .eq('id', userId)

  if (updateError) {
    console.error('payment webhook: profile update failed', updateError.message)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

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
