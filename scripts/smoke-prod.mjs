#!/usr/bin/env node
// Read-only production smoke test: no credentials, no writes.
//   node scripts/smoke-prod.mjs
//   BASE_URL=https://zapdaroca.com.br RESEND_API_KEY=... RESEND_DOMAIN_ID=... node scripts/smoke-prod.mjs
// Each check is retried so a run right after a deploy tolerates alias propagation.

import { loadEnvFile } from './lib/env.mjs'

loadEnvFile()

const BASE = (process.env.BASE_URL ?? process.env.SITE_URL ?? 'https://zapdaroca.com.br').replace(/\/$/, '')
const RETRIES = Number(process.env.SMOKE_RETRIES ?? 4)
const DELAY_MS = Number(process.env.SMOKE_DELAY_MS ?? 15000)

const get = (path, init = {}) => fetch(BASE + path, { redirect: 'manual', ...init })
const post = (path, headers = {}, body = '{}') =>
  get(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body })

function expect(cond, message) {
  if (!cond) throw new Error(message)
}
const redirectsTo = (res, suffix) => {
  const loc = res.headers.get('location') ?? ''
  expect([301, 302, 303, 307, 308].includes(res.status), `expected redirect, got ${res.status}`)
  expect(loc.endsWith(suffix), `expected redirect to …${suffix}, got ${loc || '(none)'}`)
}

const checks = [
  ['home page is up', async () => {
    const res = await get('/')
    expect(res.status === 200, `status ${res.status}`)
  }],
  ['security headers are set and framework is not advertised', async () => {
    const res = await get('/entrar')
    expect(res.headers.get('x-content-type-options') === 'nosniff', 'missing X-Content-Type-Options')
    expect(res.headers.get('x-frame-options') === 'DENY', 'missing X-Frame-Options')
    expect(!!res.headers.get('referrer-policy'), 'missing Referrer-Policy')
    expect(!res.headers.get('x-powered-by'), 'X-Powered-By is exposed')
  }],
  ['/app requires login', async () => redirectsTo(await get('/app'), '/entrar')],
  ['/app/financeiro requires login', async () => redirectsTo(await get('/app/financeiro'), '/entrar')],
  ['/assinar requires login', async () => redirectsTo(await get('/assinar'), '/entrar')],
  ['invalid confirmation link shows an error instead of a blank redirect', async () =>
    redirectsTo(await get('/auth/callback'), '/entrar?erro=link')],
  ['cron rejects anonymous calls', async () => {
    expect((await get('/api/cron')).status === 401, 'expected 401')
  }],
  ['cron rejects "Bearer undefined" (secret-not-configured bypass)', async () => {
    const res = await get('/api/cron', { headers: { authorization: 'Bearer undefined' } })
    expect(res.status === 401, `expected 401, got ${res.status}`)
  }],
  ['WhatsApp webhook rejects unsigned and badly signed posts with 401 (not 500)', async () => {
    const none = await post('/api/whatsapp/webhook')
    expect(none.status === 401, `unsigned: expected 401, got ${none.status}`)
    const bad = await post('/api/whatsapp/webhook', { 'x-hub-signature-256': 'sha256=abc' })
    expect(bad.status === 401, `bad signature: expected 401, got ${bad.status}`)
  }],
  ['WhatsApp webhook rejects a wrong verify token', async () => {
    const res = await get('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1')
    expect(res.status === 403, `expected 403, got ${res.status}`)
  }],
  ['Mercado Pago webhook never processes unsigned notifications', async () => {
    const res = await post('/api/pagamento/webhook', {}, JSON.stringify({ type: 'subscription_preapproval', id: 'x', data: { id: 'y' } }))
    // 503 = signing secret not configured yet (fails closed); 401 = secret set, signature missing
    expect([401, 503].includes(res.status), `expected 401 or 503, got ${res.status}`)
  }],
]

if (process.env.RESEND_API_KEY && process.env.RESEND_DOMAIN_ID) {
  checks.push(['Resend sending domain is verified', async () => {
    const res = await fetch(`https://api.resend.com/domains/${process.env.RESEND_DOMAIN_ID}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    })
    const body = await res.json()
    expect(body.status === 'verified', `domain status is "${body.status}"`)
  }])
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function runCheck(run) {
  let lastError
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      await run()
      return null
    } catch (err) {
      lastError = err
      if (attempt < RETRIES) await sleep(DELAY_MS)
    }
  }
  return lastError
}

console.log(`Smoke test → ${BASE}\n`)
let failed = 0
for (const [name, run] of checks) {
  const err = await runCheck(run)
  if (err) {
    failed++
    console.log(`  ✗ ${name}\n      ${err.message}`)
  } else {
    console.log(`  ✓ ${name}`)
  }
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exitCode = failed ? 1 : 0
