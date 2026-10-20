import { beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { baseSeed, createFakeDb, type FakeDb } from '@/test/fake-supabase'
import { deleteTransaction, loadCategories, recordExtra, recordPonto, recordTransaction, settleTransaction } from './ledger'

let fake: FakeDb
const db = () => fake as unknown as SupabaseClient

const base = { type: 'expense' as const, amount: 100, category: null, description: 'x', date: '2026-10-01' }

beforeEach(() => {
  fake = createFakeDb(baseSeed())
})

describe('loadCategories', () => {
  it('returns global categories plus the tenant’s own, never another tenant’s', async () => {
    const names = (await loadCategories(db(), 'user-a')).map((c) => c.name)
    expect(names).toContain('Combustível / Diesel')
    expect(names).not.toContain('Veterinário')
    expect((await loadCategories(db(), 'user-b')).map((c) => c.name)).toContain('Veterinário')
  })
})

describe('recordTransaction', () => {
  it('stores an unpaid transaction for the tenant', async () => {
    const { id } = await recordTransaction(db(), 'user-a', { ...base, messageId: 'wamid.1' })
    expect(fake.tables.transactions.find((t) => t.id === id)).toMatchObject({
      user_id: 'user-a', paid: false, paid_at: null, whatsapp_message_id: 'wamid.1', category_id: null,
    })
  })

  it('can store an already-paid transaction with its payment time', async () => {
    const { id } = await recordTransaction(db(), 'user-a', { ...base, paid: true })
    const row = fake.tables.transactions.find((t) => t.id === id)!
    expect(row.paid).toBe(true)
    expect(row.paid_at).toEqual(expect.any(String))
  })
})

describe('settleTransaction / deleteTransaction', () => {
  it('settles once, then reports it was already paid', async () => {
    const { id } = await recordTransaction(db(), 'user-a', base)
    expect(await settleTransaction(db(), 'user-a', id)).toMatchObject({ status: 'settled', amount: 100 })
    expect(await settleTransaction(db(), 'user-a', id)).toEqual({ status: 'already_paid' })
  })

  it('never touches another tenant’s transaction', async () => {
    const { id } = await recordTransaction(db(), 'user-a', base)
    expect(await settleTransaction(db(), 'user-b', id)).toEqual({ status: 'not_found' })
    expect(await deleteTransaction(db(), 'user-b', id)).toBe(false)
    expect(fake.tables.transactions).toHaveLength(1)
    expect(fake.tables.transactions[0].paid).toBe(false)
  })

  it('deletes the owner’s transaction', async () => {
    const { id } = await recordTransaction(db(), 'user-a', base)
    expect(await deleteTransaction(db(), 'user-a', id)).toBe(true)
    expect(fake.tables.transactions).toHaveLength(0)
  })
})

describe('recordPonto / recordExtra', () => {
  const joao = { id: 'e1', daily_rate: 100, overtime_rate: 15 }

  it('records one daily rate per employee and day', async () => {
    expect(await recordPonto(db(), 'user-a', joao, '2026-10-01')).toBe('recorded')
    expect(await recordPonto(db(), 'user-a', joao, '2026-10-01')).toBe('duplicate')
    expect(fake.tables.work_records).toHaveLength(1)
    expect(await recordPonto(db(), 'user-a', joao, '2026-10-02')).toBe('recorded')
  })

  it('accumulates overtime on the same day and merges with a later ponto', async () => {
    await recordExtra(db(), 'user-a', joao, 2, '2026-10-01')
    await recordExtra(db(), 'user-a', joao, 1.5, '2026-10-01')
    expect(await recordPonto(db(), 'user-a', joao, '2026-10-01')).toBe('recorded')
    expect(fake.tables.work_records).toHaveLength(1)
    expect(fake.tables.work_records[0]).toMatchObject({
      user_id: 'user-a', overtime_hours: 3.5, daily_rate_snapshot: 100, overtime_rate_snapshot: 15,
    })
  })

  it('keeps tenants apart even for the same employee id and date', async () => {
    await recordPonto(db(), 'user-a', joao, '2026-10-01')
    expect(await recordPonto(db(), 'user-b', joao, '2026-10-01')).toBe('recorded')
    expect(fake.tables.work_records.map((r) => r.user_id).sort()).toEqual(['user-a', 'user-b'])
  })
})
