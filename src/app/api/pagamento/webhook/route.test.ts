import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { baseSeed, createFakeDb, type FakeDb } from '@/test/fake-supabase'
import { hmacSha256Hex } from '@/lib/security'

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb, subscription: {} as Record<string, unknown> }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: (t: string) => h.db.from(t) } }))
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  PreApproval: class {
    async get() { return h.subscription }
  },
}))

import { POST } from './route'

const SECRET = 'mp-secret'
const NEXT_PAYMENT = '2026-11-08T12:00:00.000Z'

function post(opts: { type?: string; notificationId?: string; dataId?: string; signed?: boolean | 'bad' } = {}) {
  const { type = 'subscription_preapproval', notificationId = 'n-1', dataId = 'pre-1', signed = true } = opts
  const ts = '1700000000'
  const requestId = 'req-1'
  const v1 = hmacSha256Hex(SECRET, `id:${dataId};request-id:${requestId};ts:${ts};`)
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-request-id': requestId }
  if (signed === true) headers['x-signature'] = `ts=${ts},v1=${v1}`
  if (signed === 'bad') headers['x-signature'] = `ts=${ts},v1=${'0'.repeat(64)}`
  return POST(
    new NextRequest(`http://localhost/api/pagamento/webhook?data.id=${dataId}&type=${type}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type, id: notificationId, data: { id: dataId } }),
    })
  )
}

const profile = () => h.db.tables.profiles.find((p) => p.id === 'user-expired')!

beforeEach(() => {
  h.db = createFakeDb(baseSeed())
  h.subscription = { status: 'authorized', external_reference: 'user-expired', next_payment_date: NEXT_PAYMENT }
  vi.stubEnv('MP_WEBHOOK_SECRET', SECRET)
})

describe('authenticity', () => {
  it('rejects unsigned and badly signed notifications without touching profiles', async () => {
    expect((await post({ signed: false })).status).toBe(401)
    expect((await post({ signed: 'bad' })).status).toBe(401)
    expect(profile().subscription_status).toBe('trial')
  })

  it('refuses to run in production without a signing secret', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MP_WEBHOOK_SECRET', '')
    expect((await post({ signed: false })).status).toBe(503)
    expect(profile().subscription_status).toBe('trial')
  })

  it('still works without a secret outside production (local testing)', async () => {
    vi.stubEnv('MP_WEBHOOK_SECRET', '')
    expect((await post({ signed: false })).status).toBe(200)
  })
})

describe('subscription updates', () => {
  it('activates the tenant named in external_reference', async () => {
    expect((await post()).status).toBe(200)
    expect(profile()).toMatchObject({
      subscription_status: 'active',
      subscription_id: 'pre-1',
      current_period_end: NEXT_PAYMENT,
    })
    expect(h.db.tables.payment_events).toHaveLength(1)
  })

  it('ignores other notification types', async () => {
    const res = await post({ type: 'payment' })
    expect((await res.json()).status).toBe('ignored')
    expect(profile().subscription_status).toBe('trial')
  })

  it('processes a notification only once', async () => {
    await post()
    h.db.tables.profiles.find((p) => p.id === 'user-expired')!.subscription_status = 'paused'
    expect((await (await post()).json()).status).toBe('already_processed')
    expect(profile().subscription_status).toBe('paused')
  })

  it('cancellation keeps the paid period so access lasts until it ends', async () => {
    await post()
    h.subscription = { status: 'cancelled', external_reference: 'user-expired', next_payment_date: null }
    await post({ notificationId: 'n-2' })
    expect(profile()).toMatchObject({ subscription_status: 'cancelled', current_period_end: NEXT_PAYMENT })
  })

  it('rejects subscriptions without an external_reference', async () => {
    h.subscription = { status: 'authorized' }
    expect((await post()).status).toBe(400)
  })
})
