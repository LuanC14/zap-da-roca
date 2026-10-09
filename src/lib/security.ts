import { createHmac, timingSafeEqual } from 'node:crypto'

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

// Mercado Pago webhook signature: header `x-signature: ts=...,v1=...`
// manifest = `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
export function verifyMercadoPagoSignature(params: {
  secret: string | undefined
  xSignature: string | null
  xRequestId: string | null
  dataId: string | null
}): boolean {
  const { secret, xSignature, xRequestId, dataId } = params
  if (!secret || !xSignature || !xRequestId || !dataId) return false

  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => {
      const i = p.indexOf('=')
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()]
    })
  )
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId
  const manifest = `id:${id};request-id:${xRequestId};ts:${ts};`
  return safeEqual(hmacSha256Hex(secret, manifest), v1)
}
