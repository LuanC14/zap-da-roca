#!/usr/bin/env node
// Configures the Meta side of the WhatsApp go-live through the Graph API. DRY-RUN by default.
//   node scripts/whatsapp-setup.mjs             # plan only (reads from Meta)
//   node scripts/whatsapp-setup.mjs --apply     # do it
//   node scripts/whatsapp-setup.mjs --apply --only=webhook,subscribe,templates
//
// Steps (all idempotent):
//   webhook    point the app's whatsapp_business_account webhook at the production URL (field: messages)
//   subscribe  subscribe the app to the WhatsApp Business Account so webhooks fire
//   templates  create the two message templates the app sends on its own (OTP + daily reminder)
// Reads WHATSAPP_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_WABA_ID, WHATSAPP_VERIFY_TOKEN, SITE_URL from the environment
// or the gitignored .env.deploy. Secret values are never printed.

import { loadEnvFile } from './lib/env.mjs'

loadEnvFile()

const APPLY = process.argv.includes('--apply')
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',')
const wants = (s) => !only || only.includes(s)

const GRAPH = 'https://graph.facebook.com/v21.0'
const env = (k, fallback) => process.env[k] || fallback
const TOKEN = env('WHATSAPP_TOKEN')
const SECRET = env('WHATSAPP_APP_SECRET')
const WABA = env('WHATSAPP_WABA_ID')
const VERIFY = env('WHATSAPP_VERIFY_TOKEN')
const SITE = env('SITE_URL', 'https://zapdaroca.com.br').replace(/\/$/, '')
const CALLBACK = `${SITE}/api/whatsapp/webhook`
const LANG = env('WHATSAPP_TEMPLATE_LANG', 'pt_BR')
const OTP_TEMPLATE = env('WHATSAPP_TEMPLATE_OTP', 'zapdaroca_codigo')
const REMINDER_TEMPLATE = env('WHATSAPP_TEMPLATE_REMINDER', 'zapdaroca_lembrete')

const REMINDER_BODY =
  '☀️ Bom dia! Contas para hoje ({{1}}): {{2}}. Total: {{3}}. Para quitar, envie !pago e o número do lançamento.'

const log = (m) => console.log(m)
let failures = 0

async function graph(method, path, token, body) {
  const res = await fetch(`${GRAPH}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.error) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
  return json
}

async function mutate(description, fn) {
  log(`  ${APPLY ? '→' : '· would:'} ${description}`)
  if (!APPLY) return
  try {
    await fn()
    log('      done')
  } catch (err) {
    failures++
    log(`      FAILED: ${err.message}`)
  }
}

async function main() {
  const missing = ['WHATSAPP_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_WABA_ID', 'WHATSAPP_VERIFY_TOKEN'].filter((k) => !process.env[k])
  if (missing.length) {
    console.error(`Missing ${missing.join(', ')} (put them in .env.deploy)`)
    process.exitCode = 2
    return
  }

  log(`WhatsApp setup → ${CALLBACK}   (${APPLY ? 'APPLY' : 'dry-run: pass --apply to execute'})`)

  const dbg = await graph('GET', `/debug_token?input_token=${encodeURIComponent(TOKEN)}`, TOKEN)
  const appId = dbg.data?.app_id
  if (!appId) throw new Error('could not determine the app id from the token')
  const appToken = `${appId}|${SECRET}`

  if (wants('webhook')) {
    log('\n[webhook]')
    const subs = await graph('GET', `/${appId}/subscriptions`, appToken)
    const current = (subs.data ?? []).find((s) => s.object === 'whatsapp_business_account')
    const fields = (current?.fields ?? []).map((f) => f.name)
    if (current?.callback_url === CALLBACK && fields.includes('messages')) {
      log(`  ✓ already pointing at ${CALLBACK} with the messages field`)
    } else {
      log(`  · current callback: ${current?.callback_url ?? '(none)'}`)
      await mutate(`set callback to ${CALLBACK} (field: messages)`, () =>
        graph('POST', `/${appId}/subscriptions`, appToken, {
          object: 'whatsapp_business_account',
          callback_url: CALLBACK,
          verify_token: VERIFY,
          fields: 'messages',
        })
      )
    }
  }

  if (wants('subscribe')) {
    log('\n[subscribe]')
    const apps = await graph('GET', `/${WABA}/subscribed_apps`, TOKEN)
    if ((apps.data ?? []).some((a) => a.whatsapp_business_api_data?.id === appId || String(a.id) === String(appId))) {
      log('  ✓ app already subscribed to the WhatsApp Business Account')
    } else {
      await mutate(`subscribe app ${appId} to account ${WABA}`, () => graph('POST', `/${WABA}/subscribed_apps`, TOKEN, {}))
    }
  }

  if (wants('templates')) {
    log('\n[templates]')
    const list = await graph('GET', `/${WABA}/message_templates?fields=name,status,category,language&limit=200`, TOKEN)
    const have = (name) => (list.data ?? []).filter((t) => t.name === name)

    const wanted = [
      {
        name: OTP_TEMPLATE,
        payload: {
          name: OTP_TEMPLATE,
          language: LANG,
          category: 'AUTHENTICATION',
          components: [
            { type: 'BODY', add_security_recommendation: true },
            { type: 'FOOTER', code_expiration_minutes: 10 },
            { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'Copiar código' }] },
          ],
        },
      },
      {
        name: REMINDER_TEMPLATE,
        payload: {
          name: REMINDER_TEMPLATE,
          language: LANG,
          category: 'UTILITY',
          components: [
            {
              type: 'BODY',
              text: REMINDER_BODY,
              example: { body_text: [['24/10/2026', '#12 Diesel — R$ 120,00 | #13 Adubo — R$ 80,00', 'R$ 200,00']] },
            },
          ],
        },
      },
    ]

    for (const t of wanted) {
      const existing = have(t.name)
      if (existing.length) {
        for (const e of existing) log(`  ✓ ${t.name} [${e.language}, ${e.category}] already exists — status ${e.status}`)
      } else {
        await mutate(`create template ${t.name} (${t.payload.category}, ${LANG}) and submit it for review`, () =>
          graph('POST', `/${WABA}/message_templates`, TOKEN, t.payload)
        )
      }
    }
  }

  log(failures ? `\n${failures} step(s) failed` : '\nOK')
  process.exitCode = failures ? 1 : 0
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`)
  process.exitCode = 1
})
