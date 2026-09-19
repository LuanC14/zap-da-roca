import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { todayISO, formatBrazilian } from '@/lib/parsers/date-parser'
import { formatCurrency } from '@/lib/format'

export async function GET(req: NextRequest) {
  // Protect against external calls
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = todayISO()
  const { data } = await supabaseAdmin
    .from('transactions')
    .select('id, description, amount, categories(name)')
    .eq('transaction_date', today)
    .eq('paid', false)
    .eq('type', 'expense')

  const phone = process.env.REMINDER_PHONE_NUMBER
  if (!phone) return NextResponse.json({ status: 'no phone configured' })

  if (!data?.length) {
    await sendWhatsAppMessage(phone, `☀️ Bom dia! Nenhuma conta para pagar hoje (${formatBrazilian(today)}).`)
    return NextResponse.json({ status: 'ok', count: 0 })
  }

  const total = data.reduce((s, t) => s + t.amount, 0)
  const lines = data
    .map((t) => `  • #${t.id} ${t.description ?? (t.categories as unknown as { name: string })?.name} — ${formatCurrency(t.amount)}`)
    .join('\n')

  const msg =
    `☀️ *Bom dia! Contas para hoje (${formatBrazilian(today)})*\n\n` +
    lines +
    `\n\n💰 Total: ${formatCurrency(total)}\n\n` +
    `Use *!pago <id>* para quitar cada lançamento.`

  await sendWhatsAppMessage(phone, msg)
  return NextResponse.json({ status: 'ok', count: data.length })
}
