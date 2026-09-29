import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { todayISO, formatBrazilian } from '@/lib/parsers/date-parser'
import { formatCurrency } from '@/lib/format'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = todayISO()

  // Fetch all verified phones with active/trial subscriptions
  const { data: phones } = await supabaseAdmin
    .from('registered_phones')
    .select('user_id, whatsapp_number')
    .eq('verified', true)

  if (!phones?.length) {
    return NextResponse.json({ status: 'ok', sent: 0 })
  }

  let sent = 0

  for (const { user_id, whatsapp_number } of phones) {
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('id, description, amount, categories(name)')
      .eq('user_id', user_id)
      .eq('transaction_date', today)
      .eq('paid', false)
      .eq('type', 'expense')

    let msg: string

    if (!transactions?.length) {
      msg = `☀️ Bom dia! Nenhuma conta para pagar hoje (${formatBrazilian(today)}).`
    } else {
      const total = transactions.reduce((s, t) => s + t.amount, 0)
      const lines = transactions
        .map((t) => `  • #${t.id} ${t.description ?? (t.categories as unknown as { name: string })?.name} — ${formatCurrency(t.amount)}`)
        .join('\n')

      msg =
        `☀️ *Bom dia! Contas para hoje (${formatBrazilian(today)})*\n\n` +
        lines +
        `\n\n💰 Total: ${formatCurrency(total)}\n\n` +
        `Use *!pago <id>* para quitar cada lançamento.`
    }

    try {
      await sendWhatsAppMessage(whatsapp_number, msg)
      sent++
    } catch {
      console.error(`cron: failed to send reminder to ${whatsapp_number}`)
    }
  }

  return NextResponse.json({ status: 'ok', sent })
}
