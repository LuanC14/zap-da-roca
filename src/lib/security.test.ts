import { describe, expect, it, vi } from 'vitest'
import { hmacSha256Hex, safeEqual, verifyMercadoPagoSignature } from './security'
import { extractIncomingMessages, verifyWebhookSignature } from './whatsapp'

describe('safeEqual', () => {
  it('compares without throwing on different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('', 'x')).toBe(false)
  })
})

describe('WhatsApp webhook signature', () => {
  const body = '{"object":"whatsapp_business_account"}'

  it('accepts a correct signature', () => {
    vi.stubEnv('WHATSAPP_APP_SECRET', 's3cret')
    expect(verifyWebhookSignature(body, `sha256=${hmacSha256Hex('s3cret', body)}`)).toBe(true)
  })

  // These used to throw (RangeError from timingSafeEqual) → HTTP 500 in production
  it.each(['', 'sha256=abc', 'abc', 'sha256='])('returns false (does not throw) for %j', (sig) => {
    vi.stubEnv('WHATSAPP_APP_SECRET', 's3cret')
    expect(verifyWebhookSignature(body, sig)).toBe(false)
  })

  it('rejects a signature made with another secret or another body', () => {
    vi.stubEnv('WHATSAPP_APP_SECRET', 's3cret')
    expect(verifyWebhookSignature(body, `sha256=${hmacSha256Hex('other', body)}`)).toBe(false)
    expect(verifyWebhookSignature(body + ' ', `sha256=${hmacSha256Hex('s3cret', body)}`)).toBe(false)
  })

  it('fails closed when the secret is not configured', () => {
    vi.stubEnv('WHATSAPP_APP_SECRET', '')
    expect(verifyWebhookSignature(body, `sha256=${hmacSha256Hex('', body)}`)).toBe(false)
  })
})

describe('extractIncomingMessages', () => {
  const wrap = (messages: unknown[]) => ({ entry: [{ changes: [{ value: { messages } }] }] })

  it('returns every text message of a batched delivery', () => {
    const out = extractIncomingMessages(
      wrap([
        { from: '5511', id: 'wamid.1', type: 'text', text: { body: '!saldo' } },
        { from: '5511', id: 'wamid.2', type: 'text', text: { body: '!ajuda' } },
      ])
    )
    expect(out).toEqual([
      { from: '5511', text: '!saldo', messageId: 'wamid.1' },
      { from: '5511', text: '!ajuda', messageId: 'wamid.2' },
    ])
  })

  it('ignores non-text messages, status updates and malformed payloads', () => {
    expect(extractIncomingMessages(wrap([{ from: '1', id: 'x', type: 'image' }]))).toEqual([])
    expect(extractIncomingMessages({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] })).toEqual([])
    expect(extractIncomingMessages({})).toEqual([])
    expect(extractIncomingMessages({ entry: 'nope' })).toEqual([])
    expect(extractIncomingMessages(wrap([{ type: 'text', text: { body: 'x' } }]))).toEqual([])
  })
})

describe('verifyMercadoPagoSignature', () => {
  const secret = 'mp-secret'
  const sign = (dataId: string, requestId: string, ts: string) =>
    hmacSha256Hex(secret, `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`)

  it('accepts a valid signature', () => {
    const v1 = sign('ABC123', 'req-1', '1700000000')
    expect(
      verifyMercadoPagoSignature({ secret, xSignature: `ts=1700000000,v1=${v1}`, xRequestId: 'req-1', dataId: 'ABC123' })
    ).toBe(true)
  })

  it('rejects tampered data, request id or timestamp', () => {
    const v1 = sign('abc123', 'req-1', '1700000000')
    const base = { secret, xSignature: `ts=1700000000,v1=${v1}`, xRequestId: 'req-1', dataId: 'abc123' }
    expect(verifyMercadoPagoSignature({ ...base, dataId: 'other' })).toBe(false)
    expect(verifyMercadoPagoSignature({ ...base, xRequestId: 'req-2' })).toBe(false)
    expect(verifyMercadoPagoSignature({ ...base, xSignature: `ts=1700000001,v1=${v1}` })).toBe(false)
  })

  it('rejects missing pieces and a missing secret', () => {
    const v1 = sign('abc', 'r', '1')
    const ok = { secret, xSignature: `ts=1,v1=${v1}`, xRequestId: 'r', dataId: 'abc' }
    expect(verifyMercadoPagoSignature(ok)).toBe(true)
    expect(verifyMercadoPagoSignature({ ...ok, secret: undefined })).toBe(false)
    expect(verifyMercadoPagoSignature({ ...ok, xSignature: null })).toBe(false)
    expect(verifyMercadoPagoSignature({ ...ok, xRequestId: null })).toBe(false)
    expect(verifyMercadoPagoSignature({ ...ok, dataId: null })).toBe(false)
    expect(verifyMercadoPagoSignature({ ...ok, xSignature: 'garbage' })).toBe(false)
  })
})
