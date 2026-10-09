import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, extractIncomingMessages, sendWhatsAppMessage } from '@/lib/whatsapp'
import { parseCommand } from '@/lib/parsers/command-parser'
import { supabaseAdmin } from '@/lib/supabase'
import { safeEqual } from '@/lib/security'
import { handleCommand } from './handler'

// Meta verification handshake
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  const expected = process.env.WHATSAPP_VERIFY_TOKEN

  if (mode === 'subscribe' && expected && token && safeEqual(token, expected)) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Meta redelivers webhooks it thinks failed; claiming the message id makes each message run once
async function claimMessage(messageId: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from('whatsapp_messages').insert({ id: messageId })
  if (!error) return true
  if (error.code === '23505') return false
  console.error('whatsapp_messages claim failed, processing anyway:', error.message)
  return true
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

  const messages = extractIncomingMessages(payload)
  if (!messages.length) {
    // Non-text message or status update — acknowledge and ignore
    return NextResponse.json({ status: 'ok' })
  }

  const testMode = process.env.NODE_ENV !== 'production' && req.headers.get('x-test-mode') === '1'
  const replies: string[] = []

  for (const incoming of messages) {
    if (!(await claimMessage(incoming.messageId))) continue

    try {
      const reply = await handleCommand(parseCommand(incoming.text), incoming.from, incoming.messageId)

      // Dev-only: return reply in response body instead of sending via WhatsApp
      if (testMode) {
        replies.push(reply)
        continue
      }

      await sendWhatsAppMessage(incoming.from, reply)
    } catch (err) {
      console.error('handleCommand error:', err)
      await sendWhatsAppMessage(
        incoming.from,
        '❌ Erro interno ao processar o comando. Tente novamente em instantes.'
      ).catch(() => {})
    }
  }

  return testMode
    ? NextResponse.json({ status: 'ok', reply: replies[0], replies })
    : NextResponse.json({ status: 'ok' })
}
