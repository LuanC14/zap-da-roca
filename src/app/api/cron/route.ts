import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendDailyReminder, type DailyReminder } from '@/lib/whatsapp'
import { todayISO, formatBrazilian } from '@/lib/parsers/date-parser'
import { formatCurrency } from '@/lib/format'
import { hasAccess } from '@/lib/access'
import { safeEqual } from '@/lib/security'

const CONCURRENCY = 10
const DAY_MS = 86_400_000

export async function GET(req: NextRequest) {
  // Fail closed: without CRON_SECRET configured nobody is authorized
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization') ?? ''
  if (!secret || !safeEqual(authHeader, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = todayISO()

  // Housekeeping: expired OTPs and old webhook dedupe rows
  await supabaseAdmin.from('phone_verifications').delete().lt('expires_at', new Date(Date.now() - DAY_MS).toISOString())
  await supabaseAdmin.from('whatsapp_messages').delete().lt('created_at', new Date(Date.now() - 7 * DAY_MS).toISOString())

  const { data: phones, error: phonesError } = await supabaseAdmin
    .from('registered_phones')
    .select('user_id, whatsapp_number')
    .eq('verified', true)

  if (phonesError) {
    console.error('cron: failed to load phones', phonesError.message)
    return NextResponse.json({ error: 'Failed to load recipients' }, { status: 500 })
  }
  if (!phones?.length) return NextResponse.json({ status: 'ok', sent: 0 })

  const userIds = phones.map((p) => p.user_id)

  const [{ data: profiles }, { data: transactions }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, subscription_status, trial_ends_at, current_period_end, is_admin')
      .in('id', userIds),
    supabaseAdmin
      .from('transactions')
      .select('id, user_id, description, amount, categories(name)')
      .in('user_id', userIds)
      .eq('transaction_date', today)
      .eq('paid', false)
      .eq('type', 'expense'),
  ])

  const entitled = new Set((profiles ?? []).filter((p) => hasAccess(p)).map((p) => p.id))

  const billsByUser = new Map<string, NonNullable<typeof transactions>>()
  for (const t of transactions ?? []) {
    const list = billsByUser.get(t.user_id) ?? []
    list.push(t)
    billsByUser.set(t.user_id, list)
  }

  // Only message tenants that have access and something due today (proactive messages are billed by Meta)
  const recipients = phones.filter((p) => entitled.has(p.user_id) && billsByUser.has(p.user_id))

  let sent = 0
  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    const batch = recipients.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(({ user_id, whatsapp_number }) =>
        sendDailyReminder(whatsapp_number, buildReminder(today, billsByUser.get(user_id)!))
      )
    )
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') sent++
      else console.error(`cron: failed to send reminder to user ${batch[idx].user_id}:`, r.reason)
    })
  }

  return NextResponse.json({ status: 'ok', sent, skipped: phones.length - recipients.length })
}

function buildReminder(
  today: string,
  bills: { id: number; description: string | null; amount: number; categories: unknown }[]
): DailyReminder {
  return {
    date: formatBrazilian(today),
    items: bills.map(
      (t) => `#${t.id} ${t.description ?? (t.categories as { name: string } | null)?.name} — ${formatCurrency(t.amount)}`
    ),
    total: formatCurrency(bills.reduce((s, t) => s + t.amount, 0)),
  }
}
