import { hmacSha256Hex, safeEqual } from './security'

const GRAPH_API_VERSION = 'v21.0'
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_TOKEN
  if (!phoneNumberId || !token) throw new Error('WhatsApp credentials are not configured')

  const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WhatsApp API error: ${err}`)
  }
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret || !signature.startsWith('sha256=')) return false
  return safeEqual(`sha256=${hmacSha256Hex(secret, body)}`, signature)
}

export interface IncomingMessage {
  from: string
  text: string
  messageId: string
}

// Meta may batch several messages (and entries) in one delivery — return all text messages
export function extractIncomingMessages(payload: Record<string, unknown>): IncomingMessage[] {
  const out: IncomingMessage[] = []
  const entries = Array.isArray(payload.entry) ? (payload.entry as Record<string, unknown>[]) : []

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? (entry.changes as Record<string, unknown>[]) : []
    for (const change of changes) {
      const value = change?.value as Record<string, unknown> | undefined
      const messages = Array.isArray(value?.messages) ? (value.messages as Record<string, unknown>[]) : []
      for (const msg of messages) {
        if (msg?.type !== 'text' || typeof msg.from !== 'string' || typeof msg.id !== 'string') continue
        const body = (msg.text as Record<string, unknown> | undefined)?.body
        out.push({ from: msg.from, text: typeof body === 'string' ? body : '', messageId: msg.id })
      }
    }
  }

  return out
}
