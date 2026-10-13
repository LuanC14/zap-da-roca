import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

const h = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  updateUser: null as unknown as Mock,
  signOut: null as unknown as Mock,
  resetForEmail: null as unknown as Mock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: h.user } }),
      updateUser: h.updateUser,
      signOut: h.signOut,
      resetPasswordForEmail: h.resetForEmail,
    },
  }),
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) },
}))

import { updatePassword } from './actions'
import { requestPasswordReset } from '../esqueci-senha/actions'

const form = (fields: Record<string, string>) => {
  const f = new FormData()
  Object.entries(fields).forEach(([k, v]) => f.set(k, v))
  return f
}

beforeEach(() => {
  h.user = { id: 'u1' }
  h.updateUser = vi.fn().mockResolvedValue({ error: null })
  h.signOut = vi.fn().mockResolvedValue({ error: null })
  h.resetForEmail = vi.fn().mockResolvedValue({ error: null })
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://zapdaroca.com.br')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('requestPasswordReset', () => {
  it('asks Supabase for a recovery link that returns through the callback', async () => {
    const res = await requestPasswordReset(undefined, form({ email: ' dono@fazenda.com ' }))
    expect(res).toEqual({ sent: true })
    expect(h.resetForEmail).toHaveBeenCalledWith('dono@fazenda.com', {
      redirectTo: 'https://zapdaroca.com.br/auth/callback?next=/redefinir-senha',
    })
  })

  it('rejects malformed e-mails without calling Supabase', async () => {
    expect((await requestPasswordReset(undefined, form({ email: 'nope' })))?.error).toContain('e-mail válido')
    expect(h.resetForEmail).not.toHaveBeenCalled()
  })

  it('does not reveal whether an account exists (same answer for unknown addresses)', async () => {
    // Supabase answers "no error" for unknown addresses; the action must not add a distinguishing message
    expect(await requestPasswordReset(undefined, form({ email: 'ninguem@x.com' }))).toEqual({ sent: true })
  })

  it('reports rate limiting and delivery failures distinctly from success', async () => {
    h.resetForEmail.mockResolvedValue({ error: { status: 429, code: 'over_email_send_rate_limit', message: 'x' } })
    expect((await requestPasswordReset(undefined, form({ email: 'a@b.com' })))?.error).toContain('Muitas solicitações')

    h.resetForEmail.mockResolvedValue({ error: { status: 500, message: 'smtp down' } })
    const res = await requestPasswordReset(undefined, form({ email: 'a@b.com' }))
    expect(res?.sent).toBeUndefined()
    expect(res?.error).toContain('Não foi possível enviar')
  })
})

describe('updatePassword', () => {
  const ok = { password: 'nova-senha-123', confirm_password: 'nova-senha-123' }

  it('changes the password, ends other sessions and goes to the dashboard', async () => {
    await expect(updatePassword(undefined, form(ok))).rejects.toThrow('REDIRECT:/app')
    expect(h.updateUser).toHaveBeenCalledWith({ password: 'nova-senha-123' })
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'others' })
  })

  it('validates length and confirmation before touching the account', async () => {
    expect((await updatePassword(undefined, form({ password: 'curta', confirm_password: 'curta' })))?.error).toContain('8 caracteres')
    expect((await updatePassword(undefined, form({ password: 'nova-senha-123', confirm_password: 'outra-senha-1' })))?.error).toContain('não coincidem')
    expect(h.updateUser).not.toHaveBeenCalled()
  })

  it('requires the session created by the e-mail link', async () => {
    h.user = null
    await expect(updatePassword(undefined, form(ok))).rejects.toThrow('REDIRECT:/entrar?erro=link')
    expect(h.updateUser).not.toHaveBeenCalled()
  })

  it('explains known Supabase failures and never redirects on error', async () => {
    h.updateUser.mockResolvedValue({ error: { code: 'same_password', message: 'x' } })
    expect((await updatePassword(undefined, form(ok)))?.error).toContain('diferente da atual')

    h.updateUser.mockResolvedValue({ error: { code: 'weak_password', message: 'x' } })
    expect((await updatePassword(undefined, form(ok)))?.error).toContain('Senha fraca')

    h.updateUser.mockResolvedValue({ error: { code: 'boom', message: 'x' } })
    expect((await updatePassword(undefined, form(ok)))?.error).toContain('novo link')
    expect(h.signOut).not.toHaveBeenCalled()
  })
})
