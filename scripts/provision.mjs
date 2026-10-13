#!/usr/bin/env node
// Idempotent production provisioning. DRY-RUN by default: reads current state and prints what it would
// change; nothing is modified until you pass --apply.
//
//   node scripts/provision.mjs                      # plan only
//   node scripts/provision.mjs --apply              # do it
//   node scripts/provision.mjs --apply --only=vercel-env,domain
//   node scripts/provision.mjs --apply --smtp       # also point Supabase Auth e-mail at Resend
//
// Steps:  vercel-env | supabase-auth | domain | redeploy
// Config is read from a gitignored .env.deploy (see .env.deploy.example). Secret values are never printed.
//
// NOTE: written against the public Vercel and Supabase Management REST APIs but not run against your accounts
// yet — the dry-run (which only performs GET requests) is the way to validate it before --apply.

import { randomBytes } from 'node:crypto'
import { loadEnvFile } from './lib/env.mjs'

loadEnvFile()

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const SMTP = args.includes('--smtp')
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',')
const wants = (step) => !only || only.includes(step)

const env = (k, fallback) => process.env[k] ?? fallback
const SITE_URL = env('SITE_URL', 'https://zapdaroca.com.br').replace(/\/$/, '')
const CANONICAL = new URL(SITE_URL).host
const OTHER = CANONICAL.startsWith('www.') ? CANONICAL.slice(4) : `www.${CANONICAL}`
const VERCEL_PROJECT = env('VERCEL_PROJECT', 'zap-da-roca')
const VERCEL_API = env('VERCEL_API_URL', 'https://api.vercel.com')
const SUPABASE_API = env('SUPABASE_API_URL', 'https://api.supabase.com')
const TEAM = env('VERCEL_TEAM_ID') ? `teamId=${env('VERCEL_TEAM_ID')}` : ''

const log = (msg) => console.log(msg)
const plan = (msg) => log(`  ${APPLY ? '→' : '·'} ${APPLY ? '' : 'would: '}${msg}`)
let failures = 0

async function api(method, url, token, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text } }
  if (!res.ok) throw new Error(`${method} ${url.split('?')[0]} → ${res.status} ${JSON.stringify(json).slice(0, 200)}`)
  return json
}

// Runs a mutation only with --apply
async function mutate(description, fn) {
  plan(description)
  if (!APPLY) return
  try {
    await fn()
    log('      done')
  } catch (err) {
    failures++
    log(`      FAILED: ${err.message}`)
  }
}

const vercel = (path, query = '') => {
  const q = [TEAM, query].filter(Boolean).join('&')
  return `${VERCEL_API}${path}${q ? `?${q}` : ''}`
}

// ── Vercel environment variables ────────────────────────────────────────────
async function vercelEnv() {
  log('\n[vercel-env]')
  const token = env('VERCEL_TOKEN')
  if (!token) return log('  skipped: VERCEL_TOKEN not set')

  const { envs = [] } = await api('GET', vercel(`/v10/projects/${VERCEL_PROJECT}/env`), token)
  const prod = (key) => envs.filter((e) => e.key === key && (e.target ?? []).includes('production'))

  if (prod('CRON_SECRET').length) {
    log('  ✓ CRON_SECRET already set (left untouched)')
  } else {
    await mutate('create CRON_SECRET (random 32 bytes, encrypted, production)', () =>
      api('POST', vercel(`/v10/projects/${VERCEL_PROJECT}/env`, 'upsert=true'), token, {
        key: 'CRON_SECRET',
        value: randomBytes(32).toString('hex'),
        type: 'encrypted',
        target: ['production'],
      })
    )
  }

  for (const stale of prod('MP_TEST_PAYER_EMAIL')) {
    await mutate('delete MP_TEST_PAYER_EMAIL from production (sandbox-only override)', () =>
      api('DELETE', vercel(`/v9/projects/${VERCEL_PROJECT}/env/${stale.id}`), token)
    )
  }

  const current = prod('NEXT_PUBLIC_APP_URL')[0]
  if (current?.value === SITE_URL) {
    log(`  ✓ NEXT_PUBLIC_APP_URL already ${SITE_URL}`)
  } else {
    await mutate(`set NEXT_PUBLIC_APP_URL=${SITE_URL} (plain, production)`, () =>
      api('POST', vercel(`/v10/projects/${VERCEL_PROJECT}/env`, 'upsert=true'), token, {
        key: 'NEXT_PUBLIC_APP_URL',
        value: SITE_URL,
        type: 'plain',
        target: ['production'],
      })
    )
  }

  if (!prod('MP_WEBHOOK_SECRET').length) log('  ! MP_WEBHOOK_SECRET missing — required once Mercado Pago goes live (webhook returns 503 until then)')
}

// ── Supabase Auth: Site URL, redirect allow-list, optional SMTP ─────────────
async function supabaseAuth() {
  log('\n[supabase-auth]')
  const token = env('SUPABASE_ACCESS_TOKEN')
  const ref = env('SUPABASE_PROJECT_REF')
  if (!token || !ref) return log('  skipped: SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF not set')

  const url = `${SUPABASE_API}/v1/projects/${ref}/config/auth`
  const current = await api('GET', url, token)

  const desired = { site_url: SITE_URL, uri_allow_list: `${SITE_URL}/**` }
  if (SMTP) {
    const key = env('RESEND_API_KEY')
    if (!key) log('  ! --smtp requested but RESEND_API_KEY is not set; SMTP left unchanged')
    else {
      Object.assign(desired, {
        smtp_host: 'smtp.resend.com',
        smtp_port: '465',
        smtp_user: 'resend',
        smtp_pass: key,
        smtp_admin_email: env('SMTP_FROM', `noreply@${CANONICAL.replace(/^www\./, '')}`),
        smtp_sender_name: 'Zap da Roça',
      })
    }
  }

  const diff = Object.entries(desired).filter(([k, v]) => k !== 'smtp_pass' && current[k] !== v)
  const passChanges = desired.smtp_pass !== undefined
  if (!diff.length && !passChanges) return log('  ✓ already up to date')

  for (const [k, v] of diff) log(`  · ${k}: ${JSON.stringify(current[k] ?? null)} → ${JSON.stringify(v)}`)
  if (passChanges) log('  · smtp_pass: (will be re-sent, value hidden)')
  await mutate('PATCH auth config', () => api('PATCH', url, token, desired))
}

// ── Canonical domain: one host serves, the other redirects (308) ─────────────
async function domain() {
  log('\n[domain]')
  const token = env('VERCEL_TOKEN')
  if (!token) return log('  skipped: VERCEL_TOKEN not set')

  const read = async (d) => api('GET', vercel(`/v9/projects/${VERCEL_PROJECT}/domains/${d}`), token).catch(() => null)
  const [canonical, other] = await Promise.all([read(CANONICAL), read(OTHER)])
  if (!canonical || !other) return log(`  skipped: both ${CANONICAL} and ${OTHER} must be added to the Vercel project first`)

  if (!canonical.redirect && other.redirect === CANONICAL) return log(`  ✓ ${OTHER} → ${CANONICAL} already configured`)

  // Clear the canonical host's redirect first so the two never point at each other
  if (canonical.redirect) {
    await mutate(`serve ${CANONICAL} directly (remove its redirect to ${canonical.redirect})`, () =>
      api('PATCH', vercel(`/v9/projects/${VERCEL_PROJECT}/domains/${CANONICAL}`), token, { redirect: null })
    )
  }
  await mutate(`redirect ${OTHER} → ${CANONICAL} (308)`, () =>
    api('PATCH', vercel(`/v9/projects/${VERCEL_PROJECT}/domains/${OTHER}`), token, {
      redirect: CANONICAL,
      redirectStatusCode: 308,
    })
  )
}

// ── Redeploy so new env vars take effect ─────────────────────────────────────
async function redeploy() {
  log('\n[redeploy]')
  const hook = env('VERCEL_DEPLOY_HOOK_URL')
  if (!hook) return log('  skipped: set VERCEL_DEPLOY_HOOK_URL (Vercel → Settings → Git → Deploy Hooks) or redeploy from the dashboard')
  await mutate('trigger a production deploy via deploy hook', async () => {
    const res = await fetch(hook, { method: 'POST' })
    if (!res.ok) throw new Error(`deploy hook → ${res.status}`)
  })
}

log(`Provision → ${SITE_URL}   (${APPLY ? 'APPLY' : 'dry-run: pass --apply to execute'})`)

for (const [name, fn] of [['vercel-env', vercelEnv], ['supabase-auth', supabaseAuth], ['domain', domain], ['redeploy', redeploy]]) {
  if (!wants(name)) continue
  try {
    await fn()
  } catch (err) {
    failures++
    log(`  FAILED: ${err.message}`)
  }
}

log(failures ? `\n${failures} step(s) failed` : '\nOK')
process.exitCode = failures ? 1 : 0
