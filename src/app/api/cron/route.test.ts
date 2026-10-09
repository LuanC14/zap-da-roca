import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { FUTURE, baseSeed, createFakeDb, type FakeDb } from '@/test/fake-supabase'
import { todayISO } from '@/lib/parsers/date-parser'

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: (t: string) => h.db.from(t) } }))
const send = vi.hoisted(() => vi.fn())
vi.mock('@/lib/whatsapp', () => ({ sendWhatsAppMessage: send }))

import { GET } from './route'

const call = (auth?: string) =>
  GET(new NextRequest('http://localhost/api/cron', { headers: auth ? { authorization: auth } : {} }))

const bill = (id: number, user_id: string, amount: number, description: string, paid = false) => ({
  id, user_id, type: 'expense', amount, description, paid, transaction_date: todayISO(),
})

beforeEach(() => {
  h.db = createFakeDb(baseSeed())
  send.mockReset().mockResolvedValue(undefined)
  vi.stubEnv('CRON_SECRET', 'cron-secret')
})

describe('authorization', () => {
  it('rejects missing and wrong credentials', async () => {
    expect((await call()).status).toBe(401)
    expect((await call('Bearer nope')).status).toBe(401)
    expect((await call('cron-secret')).status).toBe(401)
  })

  it.each([undefined, ''])('fails closed when CRON_SECRET is %j ("Bearer undefined" used to pass)', async (value) => {
    vi.stubEnv('CRON_SECRET', value)
    expect((await call('Bearer undefined')).status).toBe(401)
    expect((await call('Bearer')).status).toBe(401)
    expect((await call()).status).toBe(401)
    expect(send).not.toHaveBeenCalled()
  })

  it('accepts the right secret', async () => {
    expect((await call('Bearer cron-secret')).status).toBe(200)
  })
})

describe('reminders', () => {
  it('sends each tenant only its own bills', async () => {
    h.db.tables.transactions.push(bill(1, 'user-a', 120, 'Diesel A'), bill(2, 'user-b', 340, 'Adubo B'))

    const body = await (await call('Bearer cron-secret')).json()

    expect(body.sent).toBe(2)
    const toA = send.mock.calls.find(([to]) => to === '5511999990001')![1] as string
    const toB = send.mock.calls.find(([to]) => to === '5511999990002')![1] as string
    expect(toA).toContain('Diesel A')
    expect(toA).not.toContain('Adubo B')
    expect(toB).toContain('Adubo B')
    expect(toB).not.toContain('Diesel A')
  })

  it('skips tenants with nothing due, paid bills and income', async () => {
    h.db.tables.transactions.push(
      bill(1, 'user-a', 120, 'Já paga', true),
      { ...bill(2, 'user-b', 500, 'Receita'), type: 'income' }
    )
    const body = await (await call('Bearer cron-secret')).json()
    expect(body.sent).toBe(0)
    expect(send).not.toHaveBeenCalled()
  })

  it('does not message tenants without access, but still messages admins', async () => {
    h.db.tables.transactions.push(
      bill(1, 'user-expired', 10, 'Expirado'),
      bill(2, 'user-admin', 20, 'Admin')
    )
    await call('Bearer cron-secret')
    const recipients = send.mock.calls.map(([to]) => to)
    expect(recipients).toEqual(['5511999990005'])
  })

  it('ignores unverified numbers', async () => {
    h.db.tables.transactions.push(bill(1, 'user-pending', 10, 'x'))
    await call('Bearer cron-secret')
    expect(send).not.toHaveBeenCalled()
  })

  it('keeps going when one delivery fails', async () => {
    h.db.tables.transactions.push(bill(1, 'user-a', 10, 'a'), bill(2, 'user-b', 20, 'b'))
    send.mockRejectedValueOnce(new Error('boom'))
    const body = await (await call('Bearer cron-secret')).json()
    expect(body.sent).toBe(1)
  })
})

describe('housekeeping', () => {
  it('prunes stale OTPs and webhook dedupe rows but keeps recent ones', async () => {
    const old = new Date(Date.now() - 10 * 86_400_000).toISOString()
    h.db.tables.phone_verifications.push(
      { id: 'old', expires_at: old, created_at: old },
      { id: 'fresh', expires_at: FUTURE, created_at: new Date().toISOString() }
    )
    h.db.tables.whatsapp_messages.push({ id: 'wamid.old', created_at: old }, { id: 'wamid.new', created_at: new Date().toISOString() })

    await call('Bearer cron-secret')

    expect(h.db.tables.phone_verifications.map((r) => r.id)).toEqual(['fresh'])
    expect(h.db.tables.whatsapp_messages.map((r) => r.id)).toEqual(['wamid.new'])
  })
})
