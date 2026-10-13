import { hmacSha256Hex, safeEqual } from './security'

const GRAPH_API_VERSION = 'v21.0'
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`

async function postMessage(payload: Record<string, unknown>): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_TOKEN
  if (!phoneNumberId || !token) throw new Error('WhatsApp credentials are not configured')

  const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WhatsApp API error: ${err}`)
  }
}

// Free-form text: only delivered inside the 24h window opened by the user's own message
// (i.e. replies to bot commands). Anything the app starts needs a template.
export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  await postMessage({ to, type: 'text', text: { body: text } })
}

const templateLanguage = () => process.env.WHATSAPP_TEMPLATE_LANG || 'pt_BR'

export async function sendWhatsAppTemplate(
  to: string,
  name: string,
  bodyParams: string[],
  options: { language?: string; buttonParam?: string } = {}
): Promise<void> {
  const components: Record<string, unknown>[] = [
    { type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) },
  ]
  // Authentication templates carry the code a second time for the "copy code" button
  if (options.buttonParam !== undefined) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: options.buttonParam }],
    })
  }

  await postMessage({
    to,
    type: 'template',
    template: { name, language: { code: options.language ?? templateLanguage() }, components },
  })
}

// App-initiated: OTP for linking a number. Uses the approved authentication template when
// WHATSAPP_TEMPLATE_OTP is set, plain text otherwise (Meta test number / local dev).
export async function sendVerificationCode(to: string, code: string): Promise<void> {
  const template = process.env.WHATSAPP_TEMPLATE_OTP
  if (template) {
    return sendWhatsAppTemplate(to, template, [code], { buttonParam: code })
  }
  await sendWhatsAppMessage(
    to,
    `🌾 *Zap da Roça* — Código de verificação:\n\n*${code}*\n\nVálido por 10 minutos. Não compartilhe.`
  )
}

export interface DailyReminder {
  date: string // dd/mm/aaaa
  items: string[] // "#12 Diesel — R$ 120,00"
  total: string // "R$ 120,00"
}

// App-initiated: 08:00 bills reminder. Template params may not contain line breaks, so the template
// receives the items joined on one line.
export async function sendDailyReminder(to: string, reminder: DailyReminder): Promise<void> {
  const template = process.env.WHATSAPP_TEMPLATE_REMINDER
  if (template) {
    return sendWhatsAppTemplate(to, template, [reminder.date, reminder.items.join(' | '), reminder.total])
  }
  await sendWhatsAppMessage(
    to,
    `☀️ *Bom dia! Contas para hoje (${reminder.date})*\n\n` +
      reminder.items.map((i) => `  • ${i}`).join('\n') +
      `\n\n💰 Total: ${reminder.total}\n\nUse *!pago <id>* para quitar cada lançamento.`
  )
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
