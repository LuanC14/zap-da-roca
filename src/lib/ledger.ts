import type { SupabaseClient } from '@supabase/supabase-js'
import type { CategoryRow } from '@/lib/parsers/match'

// Writes shared by the WhatsApp bot (service-role client) and the dashboard forms (session client).
// Every query is scoped by user_id explicitly, whichever client is passed in.

export async function loadCategories(db: SupabaseClient, userId: string): Promise<CategoryRow[]> {
  const { data, error } = await db
    .from('categories')
    .select('id, name, type, user_id')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('name')
  if (error) throw error
  return (data ?? []) as CategoryRow[]
}

export interface NewTransaction {
  type: 'expense' | 'income'
  amount: number
  category: CategoryRow | null
  description: string
  date: string
  paid?: boolean
  messageId?: string | null
}

export async function recordTransaction(db: SupabaseClient, userId: string, tx: NewTransaction): Promise<{ id: number }> {
  const { data, error } = await db
    .from('transactions')
    .insert({
      user_id: userId,
      type: tx.type,
      amount: tx.amount,
      category_id: tx.category?.id ?? null,
      description: tx.description,
      transaction_date: tx.date,
      paid: tx.paid ?? false,
      paid_at: tx.paid ? new Date().toISOString() : null,
      whatsapp_message_id: tx.messageId ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}

export type SettleResult =
  | { status: 'not_found' }
  | { status: 'already_paid' }
  | { status: 'settled'; amount: number; description: string | null }

export async function settleTransaction(db: SupabaseClient, userId: string, id: number): Promise<SettleResult> {
  const { data: tx, error: readError } = await db
    .from('transactions')
    .select('id, amount, description, paid')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (readError) throw readError
  if (!tx) return { status: 'not_found' }
  if (tx.paid) return { status: 'already_paid' }

  const { error } = await db
    .from('transactions')
    .update({ paid: true, paid_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error

  return { status: 'settled', amount: tx.amount, description: tx.description }
}

export async function deleteTransaction(db: SupabaseClient, userId: string, id: number): Promise<boolean> {
  const { data, error } = await db.from('transactions').delete().eq('id', id).eq('user_id', userId).select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

// A day may already hold an overtime-only record (from !extra); the daily rate is then added to it
export async function recordPonto(
  db: SupabaseClient,
  userId: string,
  employee: { id: string; daily_rate: number },
  date: string
): Promise<'recorded' | 'duplicate'> {
  const { data: existing, error: readError } = await db
    .from('work_records')
    .select('id, daily_rate_snapshot')
    .eq('user_id', userId)
    .eq('employee_id', employee.id)
    .eq('work_date', date)
  if (readError) throw readError

  if (existing?.some((r) => r.daily_rate_snapshot > 0)) return 'duplicate'

  const dayRecord = existing?.[0]
  if (dayRecord) {
    const { error } = await db
      .from('work_records')
      .update({ regular_hours: 8, daily_rate_snapshot: employee.daily_rate })
      .eq('id', dayRecord.id)
      .eq('user_id', userId)
    if (error) throw error
  } else {
    const { error } = await db.from('work_records').insert({
      user_id: userId,
      employee_id: employee.id,
      work_date: date,
      regular_hours: 8,
      overtime_hours: 0,
      daily_rate_snapshot: employee.daily_rate,
      overtime_rate_snapshot: 0,
    })
    if (error) throw error
  }
  return 'recorded'
}

export async function recordExtra(
  db: SupabaseClient,
  userId: string,
  employee: { id: string; overtime_rate: number },
  hours: number,
  date: string
): Promise<void> {
  const { data: existing, error: readError } = await db
    .from('work_records')
    .select('id, overtime_hours')
    .eq('user_id', userId)
    .eq('employee_id', employee.id)
    .eq('work_date', date)
  if (readError) throw readError

  const dayRecord = existing?.[0]
  if (dayRecord) {
    const { error } = await db
      .from('work_records')
      .update({
        overtime_hours: (dayRecord.overtime_hours ?? 0) + hours,
        overtime_rate_snapshot: employee.overtime_rate,
      })
      .eq('id', dayRecord.id)
      .eq('user_id', userId)
    if (error) throw error
  } else {
    const { error } = await db.from('work_records').insert({
      user_id: userId,
      employee_id: employee.id,
      work_date: date,
      regular_hours: 0,
      overtime_hours: hours,
      daily_rate_snapshot: 0,
      overtime_rate_snapshot: employee.overtime_rate,
    })
    if (error) throw error
  }
}
