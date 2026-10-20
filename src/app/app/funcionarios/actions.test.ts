import { beforeEach, describe, expect, it, vi } from 'vitest'
import { baseSeed, createFakeDb, type FakeDb } from '@/test/fake-supabase'

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

import { createEmployee, registerWork, setEmployeeActive, updateEmployee } from './actions'

const form = (fields: Record<string, string>) => {
  const f = new FormData()
  Object.entries(fields).forEach(([k, v]) => f.set(k, v))
  return f
}
const mine = () => h.db.tables.employees.filter((e) => e.user_id === 'user-a')

beforeEach(() => {
  h.db = createFakeDb(baseSeed())
  h.userId = 'user-a'
})

describe('access', () => {
  it('sends anonymous callers to /entrar', async () => {
    h.userId = null
    await expect(createEmployee(form({ name: 'Ana', daily_rate: '100', overtime_rate: '10' }))).rejects.toThrow('REDIRECT:/entrar')
  })

  it('sends tenants without an active plan to /assinar (server actions are public endpoints)', async () => {
    h.userId = 'user-expired'
    await expect(createEmployee(form({ name: 'Ana', daily_rate: '100', overtime_rate: '10' }))).rejects.toThrow('REDIRECT:/assinar')
    await expect(setEmployeeActive('e1', false)).rejects.toThrow('REDIRECT:/assinar')
    expect(h.db.tables.employees).toHaveLength(4)
  })
})

describe('createEmployee', () => {
  it('stores the employee for the caller with parsed pt-BR rates', async () => {
    const res = await createEmployee(form({ name: '  Ana   Paula ', daily_rate: '1.200,50', overtime_rate: '15,5' }))
    expect(res).toEqual({ ok: true })
    expect(mine().at(-1)).toMatchObject({ user_id: 'user-a', name: 'Ana Paula', daily_rate: 1200.5, overtime_rate: 15.5 })
  })

  it('accepts a zero overtime rate but never a zero daily rate', async () => {
    expect((await createEmployee(form({ name: 'Ana', daily_rate: '100', overtime_rate: '0' }))).ok).toBe(true)
    expect((await createEmployee(form({ name: 'Bia', daily_rate: '0', overtime_rate: '10' }))).error).toContain('Diária inválida')
  })

  it.each([
    [{ name: 'A', daily_rate: '100', overtime_rate: '10' }, 'nome'],
    [{ name: 'Ana', daily_rate: 'abc', overtime_rate: '10' }, 'Diária inválida'],
    [{ name: 'Ana', daily_rate: '-5', overtime_rate: '10' }, 'Diária inválida'],
    [{ name: 'Ana', daily_rate: '100', overtime_rate: 'x' }, 'Hora extra inválida'],
    [{ name: 'Ana', daily_rate: '999999999', overtime_rate: '1' }, 'Diária inválida'],
  ])('rejects invalid input %j', async (fields, message) => {
    expect((await createEmployee(form(fields))).error).toContain(message)
    expect(h.db.tables.employees).toHaveLength(4)
  })

  it('refuses a second active employee with the same name (bot lookups would be ambiguous)', async () => {
    const res = await createEmployee(form({ name: 'JOAO silva', daily_rate: '100', overtime_rate: '10' }))
    expect(res.error).toContain('Já existe')
    expect(mine()).toHaveLength(2)
  })

  it('allows the same name as another tenant’s employee', async () => {
    h.userId = 'user-b'
    expect((await createEmployee(form({ name: 'Pedro Novo', daily_rate: '100', overtime_rate: '10' }))).ok).toBe(true)
    h.userId = 'user-a'
    expect((await createEmployee(form({ name: 'Pedro Lima', daily_rate: '100', overtime_rate: '10' }))).ok).toBe(true)
  })
})

describe('updateEmployee', () => {
  it('changes rates and name of the caller’s employee', async () => {
    const res = await updateEmployee(form({ id: 'e1', name: 'João S.', daily_rate: '130', overtime_rate: '20' }))
    expect(res).toEqual({ ok: true })
    expect(h.db.tables.employees.find((e) => e.id === 'e1')).toMatchObject({ name: 'João S.', daily_rate: 130, overtime_rate: 20 })
  })

  it('cannot edit another tenant’s employee', async () => {
    const res = await updateEmployee(form({ id: 'e3', name: 'Hack', daily_rate: '1', overtime_rate: '1' }))
    expect(res.error).toContain('não encontrado')
    expect(h.db.tables.employees.find((e) => e.id === 'e3')).toMatchObject({ name: 'João Silva', daily_rate: 200 })
  })

  it('does not collide with its own name', async () => {
    expect((await updateEmployee(form({ id: 'e1', name: 'João Silva', daily_rate: '150', overtime_rate: '15' }))).ok).toBe(true)
  })

  it('refuses to rename onto another active employee', async () => {
    expect((await updateEmployee(form({ id: 'e1', name: 'José Santos', daily_rate: '100', overtime_rate: '15' }))).error).toContain('Já existe')
  })
})

describe('setEmployeeActive', () => {
  it('deactivates and reactivates without deleting history', async () => {
    expect(await setEmployeeActive('e1', false)).toEqual({ ok: true })
    expect(h.db.tables.employees.find((e) => e.id === 'e1')!.active).toBe(false)
    expect(await setEmployeeActive('e1', true)).toEqual({ ok: true })
    expect(h.db.tables.employees.find((e) => e.id === 'e1')!.active).toBe(true)
    expect(h.db.tables.employees).toHaveLength(4)
  })

  it('cannot toggle another tenant’s employee', async () => {
    expect((await setEmployeeActive('e3', false)).error).toContain('não encontrado')
    expect(h.db.tables.employees.find((e) => e.id === 'e3')!.active).toBe(true)
  })

  it('will not reactivate someone whose name is now taken by an active employee', async () => {
    await setEmployeeActive('e1', false)
    await createEmployee(form({ name: 'João Silva', daily_rate: '90', overtime_rate: '9' }))
    expect((await setEmployeeActive('e1', true)).error).toContain('Já existe')
  })
})

describe('registerWork', () => {
  const ponto = { employee_id: 'e1', kind: 'ponto', date: '2026-10-01' }
  const extra = { employee_id: 'e1', kind: 'extra', date: '2026-10-01', hours: '2,5' }

  it('records a daily rate once per day and refuses a second one', async () => {
    expect((await registerWork(form(ponto))).ok).toBe(true)
    expect(h.db.tables.work_records[0]).toMatchObject({ user_id: 'user-a', employee_id: 'e1', daily_rate_snapshot: 100 })
    expect((await registerWork(form(ponto))).error).toContain('já está registrado')
    expect(h.db.tables.work_records).toHaveLength(1)
  })

  it('records overtime hours with a decimal comma and merges them into the day', async () => {
    const res = await registerWork(form(extra))
    expect(res.ok).toBe(true)
    expect(res.message).toContain('2.5h')
    await registerWork(form(ponto))
    expect(h.db.tables.work_records).toHaveLength(1)
    expect(h.db.tables.work_records[0]).toMatchObject({ overtime_hours: 2.5, daily_rate_snapshot: 100, overtime_rate_snapshot: 15 })
  })

  it.each([
    [{ kind: 'folga' }, 'diária ou hora extra'],
    [{ date: '2026-13-01' }, 'Data inválida'],
    [{ kind: 'extra', hours: '' }, 'Horas inválidas'],
    [{ kind: 'extra', hours: '30' }, 'Horas inválidas'],
    [{ kind: 'extra', hours: '-2' }, 'Horas inválidas'],
  ])('rejects invalid input %j', async (patch, message) => {
    expect((await registerWork(form({ ...extra, ...patch }))).error).toContain(message)
    expect(h.db.tables.work_records).toHaveLength(0)
  })

  it('cannot register work for another tenant’s or an inactive employee', async () => {
    expect((await registerWork(form({ ...ponto, employee_id: 'e3' }))).error).toContain('não encontrado')
    await setEmployeeActive('e1', false)
    expect((await registerWork(form(ponto))).error).toContain('não encontrado ou inativo')
    expect(h.db.tables.work_records).toHaveLength(0)
  })

  it('requires an active plan', async () => {
    h.userId = 'user-expired'
    await expect(registerWork(form(ponto))).rejects.toThrow('REDIRECT:/assinar')
  })
})
