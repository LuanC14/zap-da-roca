import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { baseSeed, createFakeDb, type FakeDb } from '@/test/fake-supabase'

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  userId: 'user-a' as string | null,
  mpUpdate: null as unknown as Mock,
}))

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: (t: string) => h.db.from(t) } }))
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
const send = vi.hoisted(() => vi.fn())
vi.mock('@/lib/whatsapp', () => ({ sendWhatsAppMessage: send }))
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  PreApproval: class {
    async update(args: unknown) { return h.mpUpdate(args) }
  },
}))

import { cancelSubscription, sendPhoneVerification, unlinkPhone, verifyPhoneCode } from './actions'

const NEW_PHONE = '(11) 98888-7777'
const NEW_PHONE_E164 = '5511988887777'

const form = (fields: Record<string, string>) => {
  const f = new FormData()
  Object.entries(fields).forEach(([k, v]) => f.set(k, v))
  return f
}

const lastCode = () => String(h.db.tables.phone_verifications.at(-1)!.code)

beforeEach(() => {
  h.db = createFakeDb(baseSeed())
  h.userId = 'user-a'
  h.mpUpdate = vi.fn().mockResolvedValue({})
  send.mockReset().mockResolvedValue(undefined)
})

describe('authentication', () => {
  it('redirects anonymous callers to /entrar', async () => {
    h.userId = null
    await expect(sendPhoneVerification(form({ phone: NEW_PHONE }))).rejects.toThrow('REDIRECT:/entrar')
    await expect(verifyPhoneCode(form({ phone: NEW_PHONE, code: '123456' }))).rejects.toThrow('REDIRECT:/entrar')
    await expect(unlinkPhone()).rejects.toThrow('REDIRECT:/entrar')
    await expect(cancelSubscription()).rejects.toThrow('REDIRECT:/entrar')
  })
})

describe('sendPhoneVerification', () => {
  it('rejects malformed numbers', async () => {
    expect(await sendPhoneVerification(form({ phone: '12345' }))).toEqual({ error: expect.stringContaining('inválido') })
    expect(send).not.toHaveBeenCalled()
  })

  it('stores a 6-digit code bound to the user and sends it over WhatsApp', async () => {
    expect(await sendPhoneVerification(form({ phone: NEW_PHONE }))).toEqual({ sent: true })
    const row = h.db.tables.phone_verifications[0]
    expect(row).toMatchObject({ phone: NEW_PHONE_E164, user_id: 'user-a' })
    expect(String(row.code)).toMatch(/^\d{6}$/)
    expect(send).toHaveBeenCalledWith(NEW_PHONE_E164, expect.stringContaining(String(row.code)))
  })

  it('refuses a number already linked to someone else (and sends nothing)', async () => {
    const res = await sendPhoneVerification(form({ phone: '5511999990002' }))
    expect(res.error).toContain('outra conta')
    expect(send).not.toHaveBeenCalled()
    expect(h.db.tables.phone_verifications).toHaveLength(0)
  })

  it('limits codes per number to stop WhatsApp spam', async () => {
    for (let i = 0; i < 3; i++) expect((await sendPhoneVerification(form({ phone: NEW_PHONE }))).sent).toBe(true)
    expect((await sendPhoneVerification(form({ phone: NEW_PHONE }))).error).toContain('Muitas solicitações')
    expect(send).toHaveBeenCalledTimes(3)
  })

  it('limits codes per user across different numbers', async () => {
    const phones = ['(11) 90000-0001', '(11) 90000-0002', '(11) 90000-0003', '(11) 90000-0004', '(11) 90000-0005']
    for (const p of phones) expect((await sendPhoneVerification(form({ phone: p }))).sent).toBe(true)
    expect((await sendPhoneVerification(form({ phone: '(11) 90000-0006' }))).error).toContain('Muitas solicitações')
  })
})

describe('verifyPhoneCode', () => {
  beforeEach(async () => {
    await sendPhoneVerification(form({ phone: NEW_PHONE }))
  })

  it('links the number on the right code, replacing the previous one', async () => {
    expect(await verifyPhoneCode(form({ phone: NEW_PHONE, code: lastCode() }))).toEqual({ verified: true })
    const mine = h.db.tables.registered_phones.filter((p) => p.user_id === 'user-a')
    expect(mine).toEqual([expect.objectContaining({ whatsapp_number: NEW_PHONE_E164, verified: true })])
    expect(h.db.tables.phone_verifications[0].used).toBe(true)
  })

  it('does not accept a wrong code and counts the attempt', async () => {
    const wrong = lastCode() === '000000' ? '111111' : '000000'
    expect((await verifyPhoneCode(form({ phone: NEW_PHONE, code: wrong }))).error).toBe('Código incorreto.')
    expect(h.db.tables.phone_verifications[0].attempts).toBe(1)
    expect(h.db.tables.registered_phones.some((p) => p.whatsapp_number === NEW_PHONE_E164)).toBe(false)
  })

  it('locks the code after 5 wrong attempts — even the right code stops working', async () => {
    const real = lastCode()
    const wrong = real === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) await verifyPhoneCode(form({ phone: NEW_PHONE, code: wrong }))

    const res = await verifyPhoneCode(form({ phone: NEW_PHONE, code: real }))
    expect(res.verified).toBeUndefined()
    expect(res.error).toContain('Muitas tentativas')
    expect(h.db.tables.registered_phones.some((p) => p.whatsapp_number === NEW_PHONE_E164)).toBe(false)

    expect((await verifyPhoneCode(form({ phone: NEW_PHONE, code: real }))).error).toContain('expirado ou inválido')
  })

  it('does not accept a code that was issued to another user', async () => {
    h.userId = 'user-b'
    expect((await verifyPhoneCode(form({ phone: NEW_PHONE, code: lastCode() }))).error).toContain('expirado ou inválido')
  })

  it('does not accept expired codes', async () => {
    h.db.tables.phone_verifications[0].expires_at = new Date(Date.now() - 1000).toISOString()
    expect((await verifyPhoneCode(form({ phone: NEW_PHONE, code: lastCode() }))).error).toContain('expirado ou inválido')
  })

  it('cannot be reused', async () => {
    const code = lastCode()
    await verifyPhoneCode(form({ phone: NEW_PHONE, code }))
    expect((await verifyPhoneCode(form({ phone: NEW_PHONE, code }))).error).toContain('expirado ou inválido')
  })

  it('never takes over a number another tenant linked after the code was issued', async () => {
    h.db.tables.registered_phones.push({ user_id: 'user-b', whatsapp_number: NEW_PHONE_E164, verified: true })
    const res = await verifyPhoneCode(form({ phone: NEW_PHONE, code: lastCode() }))
    expect(res.error).toContain('outra conta')
    expect(h.db.tables.registered_phones.find((p) => p.whatsapp_number === NEW_PHONE_E164)).toMatchObject({ user_id: 'user-b' })
  })
})

describe('unlinkPhone', () => {
  it('removes only the caller’s number', async () => {
    expect(await unlinkPhone()).toEqual({})
    const numbers = h.db.tables.registered_phones.map((p) => p.whatsapp_number)
    expect(numbers).not.toContain('5511999990001')
    expect(numbers).toContain('5511999990002')
  })
})

describe('cancelSubscription', () => {
  it('cancels at Mercado Pago and locally', async () => {
    h.db.tables.profiles.find((p) => p.id === 'user-a')!.subscription_id = 'pre-1'
    expect(await cancelSubscription()).toEqual({})
    expect(h.mpUpdate).toHaveBeenCalledWith({ id: 'pre-1', body: { status: 'cancelled' } })
    expect(h.db.tables.profiles.find((p) => p.id === 'user-a')!.subscription_status).toBe('cancelled')
  })

  it('does NOT mark it cancelled locally if Mercado Pago fails (customer would keep being charged)', async () => {
    h.db.tables.profiles.find((p) => p.id === 'user-a')!.subscription_id = 'pre-1'
    h.mpUpdate.mockRejectedValue(new Error('mp down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await cancelSubscription()).error).toContain('Mercado Pago')
    expect(h.db.tables.profiles.find((p) => p.id === 'user-a')!.subscription_status).toBe('active')
  })

  it('cancels locally when there is no Mercado Pago subscription yet', async () => {
    expect(await cancelSubscription()).toEqual({})
    expect(h.mpUpdate).not.toHaveBeenCalled()
  })
})
