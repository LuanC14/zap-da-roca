import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { baseSeed, createFakeDb, type FakeDb } from '@/test/fake-supabase'
import { hmacSha256Hex } from '@/lib/security'

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: (t: string) => h.db.from(t) } }))
const send = vi.hoisted(() => vi.fn())
vi.mock('@/lib/whatsapp', async (orig) => ({ ...(await orig<typeof import('@/lib/whatsapp')>()), sendWhatsAppMessage: send }))

import { GET, POST } from './route'

const SECRET = 'app-secret'

function payload(messages: { id: string; text: string; from?: string }[]) {
  return JSON.stringify({
    entry: [{
      changes: [{
        value: {
          messages: messages.map((m) => ({
            from: m.from ?? '5511999990001',
            id: m.id,
            type: 'text',
            text: { body: m.text },
          })),
        },
      }],
    }],
  })
}

function post(body: string, opts: { signature?: string | null; testMode?: boolean } = {}) {
  const headers: Record<string, string> = {}
  const sig = opts.signature === undefined ? `sha256=${hmacSha256Hex(SECRET, body)}` : opts.signature
  if (sig !== null) headers['x-hub-signature-256'] = sig
  if (opts.testMode) headers['x-test-mode'] = '1'
  return POST(new NextRequest('http://localhost/api/whatsapp/webhook', { method: 'POST', body, headers }))
}

beforeEach(() => {
  h.db = createFakeDb(baseSeed())
  send.mockReset().mockResolvedValue(undefined)
  vi.stubEnv('WHATSAPP_APP_SECRET', SECRET)
  vi.stubEnv('WHATSAPP_VERIFY_TOKEN', 'verify-me')
})

describe('GET handshake', () => {
  const get = (qs: string) => GET(new NextRequest(`http://localhost/api/whatsapp/webhook?${qs}`))

  it('echoes the challenge only for the right token', async () => {
    const ok = await get('hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=123')
    expect(ok.status).toBe(200)
    expect(await ok.text()).toBe('123')
    expect((await get('hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1')).status).toBe(403)
  })

  it('fails closed when no verify token is configured', async () => {
    vi.stubEnv('WHATSAPP_VERIFY_TOKEN', '')
    expect((await get('hub.mode=subscribe&hub.verify_token=&hub.challenge=1')).status).toBe(403)
  })
})

describe('POST signature', () => {
  const body = payload([{ id: 'wamid.1', text: '!saldo' }])

  // Production returned 500 for these because timingSafeEqual threw on length mismatch
  it.each([
    ['missing', null],
    ['malformed', 'sha256=abc'],
    ['wrong prefix', 'abc'],
    ['wrong secret', `sha256=${hmacSha256Hex('other', body)}`],
  ])('answers 401 for a %s signature', async (_label, signature) => {
    const res = await post(body, { signature })
    expect(res.status).toBe(401)
    expect(send).not.toHaveBeenCalled()
  })

  it('answers 400 for a signed non-JSON body', async () => {
    expect((await post('not json')).status).toBe(400)
  })

  it('acknowledges signed deliveries with nothing to process', async () => {
    expect((await post(JSON.stringify({ entry: [] }))).status).toBe(200)
  })
})

describe('POST processing', () => {
  it('replies to the sender over WhatsApp', async () => {
    const res = await post(payload([{ id: 'wamid.1', text: '!ajuda' }]))
    expect(res.status).toBe(200)
    expect(send).toHaveBeenCalledWith('5511999990001', expect.stringContaining('Comandos disponíveis'))
  })

  it('runs a redelivered message only once (Meta retries → no duplicate expense)', async () => {
    const body = payload([{ id: 'wamid.dup', text: '!pagar 100 diesel a' }])
    await post(body)
    await post(body)
    expect(h.db.tables.transactions).toHaveLength(1)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('processes every message of a batched delivery', async () => {
    await post(payload([
      { id: 'wamid.a', text: '!pagar 10 diesel a' },
      { id: 'wamid.b', text: '!pagar 20 diesel b' },
    ]))
    expect(h.db.tables.transactions).toHaveLength(2)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('returns the reply in the body only in dev test mode', async () => {
    const res = await post(payload([{ id: 'wamid.t', text: '!ajuda' }]), { testMode: true })
    expect((await res.json()).reply).toContain('Comandos disponíveis')
    expect(send).not.toHaveBeenCalled()

    vi.stubEnv('NODE_ENV', 'production')
    const prod = await post(payload([{ id: 'wamid.t2', text: '!ajuda' }]), { testMode: true })
    expect((await prod.json()).reply).toBeUndefined()
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('tells the user when something breaks, without failing the webhook', async () => {
    const real = h.db.from.bind(h.db)
    h.db.from = (t: string) => {
      if (t === 'whatsapp_messages') return real(t)
      throw new Error('db down')
    }
    const res = await post(payload([{ id: 'wamid.err', text: '!saldo' }]))
    expect(res.status).toBe(200)
    expect(send).toHaveBeenCalledWith('5511999990001', expect.stringContaining('Erro interno'))
  })
})
