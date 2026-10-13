// Where the auth callback may send a user after exchanging the e-mail code.
// An allow-list (not just "starts with /") so a crafted link can never bounce someone to another site.
const ALLOWED_PREFIXES = ['/app', '/redefinir-senha']

export function safeNext(next: string | null | undefined, fallback = '/app'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u001f]/.test(next)) return fallback

  let url: URL
  try {
    url = new URL(next, 'http://local.invalid')
  } catch {
    return fallback
  }
  if (url.origin !== 'http://local.invalid') return fallback

  const allowed = ALLOWED_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))
  return allowed ? `${url.pathname}${url.search}` : fallback
}
