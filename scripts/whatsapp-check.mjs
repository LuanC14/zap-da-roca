#!/usr/bin/env node
// Read-only check of the WhatsApp Business Cloud API setup (Meta Graph API). Prints no secrets.
//   npm run whatsapp:check
// Reads WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and (for templates) WHATSAPP_WABA_ID from the environment
// or the gitignored .env.deploy. Template names default to the ones the app expects.

import { loadEnvFile } from './lib/env.mjs'

loadEnvFile()

const GRAPH = 'https://graph.facebook.com/v21.0'
const token = process.env.WHATSAPP_TOKEN
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
const wabaId = process.env.WHATSAPP_WABA_ID
const wanted = [
  process.env.WHATSAPP_TEMPLATE_OTP || 'zapdaroca_codigo',
  process.env.WHATSAPP_TEMPLATE_REMINDER || 'zapdaroca_lembrete',
]

if (!token || !phoneId) {
  console.error('Missing WHATSAPP_TOKEN and/or WHATSAPP_PHONE_NUMBER_ID (put them in .env.deploy)')
  process.exitCode = 2
} else {
  let problems = 0
  const ok = (msg) => console.log(`  ✓ ${msg}`)
  const bad = (msg) => { problems++; console.log(`  ✗ ${msg}`) }
  const info = (msg) => console.log(`  · ${msg}`)

  async function graph(path) {
    const res = await fetch(`${GRAPH}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
    return body
  }

  console.log('WhatsApp check\n')

  try {
    const p = await graph(`/${phoneId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,name_status,platform_type,throughput`)
    ok(`number ${p.display_phone_number} · name "${p.verified_name}"`)
    p.code_verification_status === 'VERIFIED' ? ok('number is verified') : bad(`number verification status: ${p.code_verification_status}`)
    p.name_status && p.name_status !== 'APPROVED' ? bad(`display name status: ${p.name_status} (must be APPROVED to leave the sandbox limits)`) : ok('display name approved')
    info(`quality rating: ${p.quality_rating ?? 'n/a'} · platform: ${p.platform_type ?? 'n/a'}`)
    if (p.platform_type && p.platform_type !== 'CLOUD_API') bad('number is not on the Cloud API platform')
  } catch (err) {
    bad(`phone number lookup failed — wrong id or token without access: ${err.message}`)
  }

  if (!wabaId) {
    info('WHATSAPP_WABA_ID not set: skipping template and subscription checks')
  } else {
    try {
      const t = await graph(`/${wabaId}/message_templates?fields=name,status,category,language&limit=200`)
      for (const name of wanted) {
        const found = (t.data ?? []).filter((x) => x.name === name)
        if (!found.length) bad(`template "${name}" not found — submit it in WhatsApp Manager`)
        else for (const x of found) {
          x.status === 'APPROVED' ? ok(`template "${name}" [${x.language}, ${x.category}] APPROVED`) : bad(`template "${name}" [${x.language}] is ${x.status}`)
        }
      }
    } catch (err) {
      bad(`template lookup failed: ${err.message}`)
    }

    try {
      const s = await graph(`/${wabaId}/subscribed_apps`)
      ;(s.data ?? []).length ? ok(`app subscribed to the account (${s.data.length})`) : bad('no app subscribed to this WhatsApp Business Account (webhook will not fire)')
    } catch (err) {
      bad(`subscription lookup failed: ${err.message}`)
    }
  }

  console.log(problems ? `\n${problems} problem(s)` : '\nAll good')
  process.exitCode = problems ? 1 : 0
}
