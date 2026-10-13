import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ exchange: null as unknown as ReturnType<typeof import('vitest').vi.fn> }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: h.exchange } }),
}))

import { GET } from './route'

const call = (qs: string) => GET(new Request(`https://zapdaroca.com.br/auth/callback${qs}`))
const location = (res: Response) => res.headers.get('location')

beforeEach(() => {
  h.exchange = vi.fn().mockResolvedValue({ error: null })
})

describe('/auth/callback', () => {
  it('sends users to the dashboard after confirming the e-mail', async () => {
    const res = await call('?code=abc')
    expect(h.exchange).toHaveBeenCalledWith('abc')
    expect(location(res)).toBe('https://zapdaroca.com.br/app')
  })

  it('lands on the new-password page for recovery links', async () => {
    expect(location(await call('?code=abc&next=/redefinir-senha'))).toBe('https://zapdaroca.com.br/redefinir-senha')
  })

  it('ignores a hostile next parameter', async () => {
    expect(location(await call('?code=abc&next=https://evil.com'))).toBe('https://zapdaroca.com.br/app')
    expect(location(await call('?code=abc&next=//evil.com'))).toBe('https://zapdaroca.com.br/app')
  })

  it('shows the login error when the code is missing or rejected', async () => {
    expect(location(await call(''))).toBe('https://zapdaroca.com.br/entrar?erro=link')
    expect(h.exchange).not.toHaveBeenCalled()

    h.exchange.mockResolvedValue({ error: { message: 'expired' } })
    expect(location(await call('?code=old'))).toBe('https://zapdaroca.com.br/entrar?erro=link')
  })
})
