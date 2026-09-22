import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, extractIncomingMessage, sendWhatsAppMessage } from '@/lib/whatsapp'
import { parseCommand } from '@/lib/parsers/command-parser'
import { handleCommand } from './handler'

// Meta verification handshake
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256') ?? ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const incoming = extractIncomingMessage(payload)
  if (!incoming) {
    // Non-text message or status update — acknowledge and ignore
    return NextResponse.json({ status: 'ok' })
  }

  const parsed = parseCommand(incoming.text)

  try {
    const reply = await handleCommand(parsed, incoming.from, incoming.messageId)

    // Dev-only: return reply in response body instead of sending via WhatsApp
    if (process.env.NODE_ENV !== 'production' && req.headers.get('x-test-mode') === '1') {
      return NextResponse.json({ status: 'ok', reply })
    }

    await sendWhatsAppMessage(incoming.from, reply)
  } catch (err) {
    console.error('handleCommand error:', err)
    await sendWhatsAppMessage(
      incoming.from,
      '❌ Erro interno ao processar o comando. Tente novamente em instantes.'
    ).catch(() => {})
  }

  return NextResponse.json({ status: 'ok' })
}
