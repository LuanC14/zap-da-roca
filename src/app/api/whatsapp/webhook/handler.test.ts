import { beforeEach, describe, expect, it, vi } from 'vitest'
import { baseSeed, createFakeDb, type FakeDb } from '@/test/fake-supabase'
import { parseCommand } from '@/lib/parsers/command-parser'
import { todayISO } from '@/lib/parsers/date-parser'

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: (t: string) => h.db.from(t) } }))

import { handleCommand } from './handler'

const A = '5511999990001' // active
const B = '5511999990002' // trial
const EXPIRED = '5511999990003'
const PENDING = '5511999990004' // number not verified yet
const ADMIN = '5511999990005' // admin with expired trial

const say = (from: string, text: string, id = `wamid.${Math.random()}`) =>
  handleCommand(parseCommand(text), from, id)

beforeEach(() => {
  h.db = createFakeDb(baseSeed())
})

describe('who may talk to the bot', () => {
  it('rejects numbers that are not linked', async () => {
    expect(await say('5500000000000', '!saldo')).toContain('Número não cadastrado')
  })

  it('rejects numbers whose OTP was never verified', async () => {
    expect(await say(PENDING, '!saldo')).toContain('Número não cadastrado')
  })

  it('blocks tenants whose trial ended (the gate used to cover only the website)', async () => {
    expect(await say(EXPIRED, '!saldo')).toContain('período de acesso terminou')
    expect(await say(EXPIRED, '!pagar 10 diesel x')).toContain('período de acesso terminou')
    expect(h.db.tables.transactions).toHaveLength(0)
  })

  it('lets admins through even with an expired trial', async () => {
    expect(await say(ADMIN, '!pagar 10 diesel x')).toContain('Despesa registrada')
  })

  it('answers !ajuda for active tenants', async () => {
    expect(await say(A, '!ajuda')).toContain('Comandos disponíveis')
    expect(await say(A, '!blabla')).toContain('Comando não reconhecido')
  })
})

describe('!pagar / !receber', () => {
  it('stores the transaction for the right tenant with the typed description', async () => {
    const reply = await say(A, '!pagar 350 combustivel Abastecimento do Trator', 'wamid.1')
    expect(reply).toContain('Despesa registrada')
    expect(reply).toContain('Combustível / Diesel')
    expect(h.db.tables.transactions).toEqual([
      expect.objectContaining({
        user_id: 'user-a',
        type: 'expense',
        amount: 350,
        category_id: 'c2',
        description: 'Abastecimento do Trator',
        transaction_date: todayISO(),
        paid: false,
        whatsapp_message_id: 'wamid.1',
      }),
    ])
  })

  it.each([
    ['maquinario', 'c3'],
    ['maodeobra', 'c4'],
    ['insumos', 'c1'],
  ])('resolves the documented keyword "%s" to the accented category', async (kw, id) => {
    await say(A, `!pagar 10 ${kw} teste`)
    expect(h.db.tables.transactions[0]).toMatchObject({ category_id: id })
  })

  it('records income against income categories', async () => {
    await say(A, '!receber 8000 safra venda do milho')
    expect(h.db.tables.transactions[0]).toMatchObject({ type: 'income', category_id: 'c5', amount: 8000 })
  })

  it('keeps Brazilian-formatted amounts intact', async () => {
    await say(A, '!pagar 1.500,00 insumos adubo')
    expect(h.db.tables.transactions[0]).toMatchObject({ amount: 1500 })
  })

  it("never uses another tenant's custom category", async () => {
    // "Veterinário" belongs to user B
    expect(await say(A, '!pagar 50 veterinario vacina')).toContain('sem categoria')
    expect(h.db.tables.transactions[0]).toMatchObject({ user_id: 'user-a', category_id: null })

    await say(B, '!pagar 50 veterinario vacina')
    expect(h.db.tables.transactions[1]).toMatchObject({ user_id: 'user-b', category_id: 'c6' })
  })

  it('rejects zero, negative and malformed amounts without writing anything', async () => {
    for (const t of ['!pagar 0 diesel', '!pagar -500 diesel', '!pagar abc diesel', '!pagar 350']) {
      expect(await say(A, t)).toContain('Formato inválido')
    }
    expect(h.db.tables.transactions).toHaveLength(0)
  })
})

describe('!pago', () => {
  it('settles only the caller’s own transactions', async () => {
    await say(A, '!pagar 100 diesel a')
    const id = h.db.tables.transactions[0].id

    expect(await say(B, `!pago ${id}`)).toContain('não encontrado')
    expect(h.db.tables.transactions[0].paid).toBe(false)

    expect(await say(A, `!pago ${id}`)).toContain('quitado')
    expect(h.db.tables.transactions[0].paid).toBe(true)
  })

  it('is idempotent and says so', async () => {
    await say(A, '!pagar 100 diesel a')
    const id = h.db.tables.transactions[0].id
    await say(A, `!pago ${id}`)
    expect(await say(A, `!pago ${id}`)).toContain('já estava quitado')
  })

  it('asks for an id', async () => {
    expect(await say(A, '!pago')).toContain('Informe o ID')
  })
})

describe('!saldo / !relatorio isolation', () => {
  beforeEach(async () => {
    await say(A, '!receber 1000 safra venda')
    await say(A, '!pagar 300 diesel a')
    await say(B, '!receber 999999 safra venda')
    await say(B, '!pagar 111111 diesel b')
  })

  it('!saldo sums only the caller’s data', async () => {
    const reply = await say(A, '!saldo')
    expect(reply).toContain('1.000,00')
    expect(reply).toContain('300,00')
    expect(reply).toContain('700,00')
    expect(reply).not.toContain('999.999')
    expect(reply).not.toContain('111.111')
  })

  it('!relatorio lists only the caller’s data', async () => {
    const reply = await say(B, '!relatorio')
    expect(reply).toContain('999.999,00')
    expect(reply).not.toContain('1.000,00')
  })

  it('!relatorio validates the period', async () => {
    expect(await say(A, '!relatorio 99/2026')).toContain('Período inválido')
  })
})

describe('employees', () => {
  it('!funcionarios lists only the caller’s team', async () => {
    const reply = await say(A, '!funcionarios')
    expect(reply).toContain('João Silva')
    expect(reply).toContain('José Santos')
    expect(reply).not.toContain('Pedro Lima')
  })

  it('!ponto finds accented names from unaccented input and uses the tenant’s own rate', async () => {
    const reply = await say(A, '!ponto joao')
    expect(reply).toContain('Ponto registrado')
    expect(reply).toContain('João Silva')
    expect(h.db.tables.work_records).toEqual([
      expect.objectContaining({ user_id: 'user-a', employee_id: 'e1', daily_rate_snapshot: 100, work_date: todayISO() }),
    ])
  })

  it('!ponto cannot reach another tenant’s employee', async () => {
    expect(await say(A, '!ponto pedro')).toContain('não encontrado')
    expect(h.db.tables.work_records).toHaveLength(0)
  })

  it('!ponto twice on the same day does not double the daily rate', async () => {
    await say(A, '!ponto joao')
    expect(await say(A, '!ponto joao')).toContain('já está registrado')
    expect(h.db.tables.work_records).toHaveLength(1)
  })

  it('!ponto asks for a full name when it is ambiguous', async () => {
    h.db.tables.employees.push({ id: 'e9', user_id: 'user-a', name: 'João Pereira', daily_rate: 80, overtime_rate: 10, active: true })
    expect(await say(A, '!ponto joao')).toContain('Mais de um funcionário')
    expect(h.db.tables.work_records).toHaveLength(0)
    expect(await say(A, '!ponto joao silva')).toContain('Ponto registrado')
  })

  it('!extra accumulates hours (decimal comma) on the same day', async () => {
    await say(A, '!extra joao 2,5')
    await say(A, '!extra joao 1')
    expect(h.db.tables.work_records).toHaveLength(1)
    expect(h.db.tables.work_records[0]).toMatchObject({ overtime_hours: 3.5, overtime_rate_snapshot: 15 })
  })

  it('!ponto after !extra completes the same day record instead of duplicating it', async () => {
    await say(A, '!extra joao 2')
    expect(await say(A, '!ponto joao')).toContain('Ponto registrado')
    expect(h.db.tables.work_records).toHaveLength(1)
    expect(h.db.tables.work_records[0]).toMatchObject({ daily_rate_snapshot: 100, overtime_hours: 2 })
  })

  it('!extra rejects invalid hours', async () => {
    expect(await say(A, '!extra joao 30')).toContain('Formato inválido')
    expect(await say(A, '!extra joao -2')).toContain('Formato inválido')
    expect(h.db.tables.work_records).toHaveLength(0)
  })

  it('!mao_obra totals only the caller’s records', async () => {
    await say(A, '!ponto joao')
    await say(A, '!extra joao 2')
    await say(B, '!ponto pedro')
    const reply = await say(A, '!mao_obra')
    expect(reply).toContain('João Silva')
    expect(reply).toContain('130,00') // 100 + 2h × 15
    expect(reply).not.toContain('Pedro')
  })
})

describe('Brazilian ninth digit (Meta may report either form of the same number)', () => {
  it('finds a number stored with the ninth digit when the webhook reports it without', async () => {
    // stored: 5511999990001 (13 digits) → webhook sends 551199990001 (12 digits)
    expect(await say('551199990001', '!ajuda')).toContain('Comandos disponíveis')
  })

  it('finds a number stored without the ninth digit when the webhook reports it with', async () => {
    h.db.tables.registered_phones.push({ user_id: 'user-a', whatsapp_number: '551188887777', verified: true })
    expect(await say('5511988887777', '!ajuda')).toContain('Comandos disponíveis')
  })

  it('keeps tenants apart through the alternate form', async () => {
    await say('551199990001', '!receber 1000 safra venda')
    await say('551199990002', '!receber 5 safra venda')
    expect(h.db.tables.transactions.map((t) => [t.user_id, t.amount])).toEqual([['user-a', 1000], ['user-b', 5]])
  })

  it('still rejects numbers that match no registered phone in any form', async () => {
    expect(await say('551199990099', '!ajuda')).toContain('Número não cadastrado')
  })
})
