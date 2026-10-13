import { describe, expect, it } from 'vitest'
import { safeNext } from './redirects'

describe('safeNext', () => {
  it('defaults to the dashboard', () => {
    expect(safeNext(null)).toBe('/app')
    expect(safeNext(undefined)).toBe('/app')
    expect(safeNext('')).toBe('/app')
  })

  it('accepts the in-app destinations', () => {
    expect(safeNext('/redefinir-senha')).toBe('/redefinir-senha')
    expect(safeNext('/app')).toBe('/app')
    expect(safeNext('/app/financeiro?month=2026-09')).toBe('/app/financeiro?month=2026-09')
  })

  // An open redirect on the auth callback would let a phishing link ride on our domain
  it.each([
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    '\\\\evil.com',
    'javascript:alert(1)',
    '/app\r\nSet-Cookie: x=1',
    '/entrar',
    '/api/cron',
    '/appendix',
    'evil.com',
  ])('rejects %j', (value) => {
    expect(safeNext(value)).toBe('/app')
  })

  it('uses a custom fallback', () => {
    expect(safeNext('https://evil.com', '/entrar')).toBe('/entrar')
  })
})
