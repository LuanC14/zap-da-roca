import { beforeEach, describe, expect, it, vi } from 'vitest'
import { baseSeed, createFakeDb, type FakeDb } from '@/test/fake-supabase'
import { todayISO } from '@/lib/parsers/date-parser'

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb, userId: 'user-a' as string | null }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.userId ? { id: h.userId } : null } }) },
    from: (t: string) => h.db.from(t),
  }),
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.spyOn(console, 'error').mockImplementation(() => {})

import { createTransaction, deleteTransactionAction, settleTransactionAction } from './actions'

const form = (fields: Record<string, string>) => {
  const f = new FormData()
  Object.entries(fields).forEach(([k, v]) => f.set(k, v))
  return f
}
const valid = { type: 'expense', amount: '350,50', date: todayISO(), category_id: 'c2', description: 'Diesel do trator' }

beforeEach(() => {
  h.db = createFakeDb(baseSeed())
  h.userId = 'user-a'
})

describe('access', () => {
  it('redirects anonymous callers and tenants without a plan', async () => {
    h.userId = null
    await expect(createTransaction(form(valid))).rejects.toThrow('REDIRECT:/entrar')
    h.userId = 'user-expired'
    await expect(createTransaction(form(valid))).rejects.toThrow('REDIRECT:/assinar')
    await expect(settleTransactionAction(1)).rejects.toThrow('REDIRECT:/assinar')
    await expect(deleteTransactionAction(1)).rejects.toThrow('REDIRECT:/assinar')
    expect(h.db.tables.transactions).toHaveLength(0)
  })
})

describe('createTransaction', () => {
  it('stores a transaction for the caller, parsing pt-BR amounts', async () => {
    expect(await createTransaction(form(valid))).toEqual({ ok: true })
    expect(h.db.tables.transactions).toEqual([
      expect.objectContaining({
        user_id: 'user-a', type: 'expense', amount: 350.5, category_id: 'c2',
        description: 'Diesel do trator', paid: false, transaction_date: todayISO(),
      }),
    ])
  })

  it('falls back to the category name, then to a generic label, when no description is given', async () => {
    await createTransaction(form({ ...valid, description: '' }))
    await createTransaction(form({ ...valid, description: '', category_id: '', type: 'income' }))
    expect(h.db.tables.transactions.map((t) => t.description)).toEqual(['Combustível / Diesel', 'Receita'])
  })

  it('marks it paid when the box is ticked', async () => {
    await createTransaction(form({ ...valid, paid: 'on' }))
    expect(h.db.tables.transactions[0]).toMatchObject({ paid: true })
  })

  it.each([
    [{ type: 'transfer' }, 'despesa ou receita'],
    [{ amount: '0' }, 'Valor inválido'],
    [{ amount: '-10' }, 'Valor inválido'],
    [{ amount: 'abc' }, 'Valor inválido'],
    [{ date: '2026-02-30' }, 'Data inválida'],
    [{ date: '1999-01-01' }, 'Data inválida'],
    [{ date: '' }, 'Data inválida'],
    [{ description: 'x'.repeat(121) }, 'muito longa'],
  ])('rejects invalid input %j', async (patch, message) => {
    expect((await createTransaction(form({ ...valid, ...patch }))).error).toContain(message)
    expect(h.db.tables.transactions).toHaveLength(0)
  })

  it('rejects a category that does not fit the type or belongs to someone else', async () => {
    // c5 is income-only
    expect((await createTransaction(form({ ...valid, category_id: 'c5' }))).error).toContain('Categoria inválida')
    // c6 belongs to user-b
    expect((await createTransaction(form({ ...valid, category_id: 'c6' }))).error).toContain('Categoria inválida')
    expect((await createTransaction(form({ ...valid, category_id: 'nope' }))).error).toContain('Categoria inválida')
    expect(h.db.tables.transactions).toHaveLength(0)
  })

  it('accepts income against an income category', async () => {
    expect((await createTransaction(form({ ...valid, type: 'income', category_id: 'c5' }))).ok).toBe(true)
  })
})

describe('settle / delete', () => {
  beforeEach(async () => {
    await createTransaction(form(valid))
  })

  it('settles and deletes the caller’s own transaction', async () => {
    const id = h.db.tables.transactions[0].id as number
    expect(await settleTransactionAction(id)).toEqual({ ok: true })
    expect(h.db.tables.transactions[0].paid).toBe(true)
    expect(await deleteTransactionAction(id)).toEqual({ ok: true })
    expect(h.db.tables.transactions).toHaveLength(0)
  })

  it('cannot settle or delete another tenant’s transaction', async () => {
    const id = h.db.tables.transactions[0].id as number
    h.userId = 'user-b'
    expect((await settleTransactionAction(id)).error).toContain('não encontrado')
    expect((await deleteTransactionAction(id)).error).toContain('não encontrado')
    expect(h.db.tables.transactions).toHaveLength(1)
    expect(h.db.tables.transactions[0].paid).toBe(false)
  })

  it('rejects malformed ids', async () => {
    for (const bad of [0, -1, 1.5, NaN]) {
      expect((await settleTransactionAction(bad)).error).toContain('inválido')
      expect((await deleteTransactionAction(bad)).error).toContain('inválido')
    }
  })
})
