/**
 * Simula mensagens do WhatsApp direto no webhook local.
 * Uso: node scripts/test-bot.js "!ajuda"
 *      node scripts/test-bot.js "!pagar 350 combustivel abastecimento trator"
 *      node scripts/test-bot.js "!saldo"
 */

const crypto = require('crypto')
const http = require('http')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const content = fs.readFileSync(envPath, 'utf-8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
  }
  return env
}

const env = loadEnv()
const APP_SECRET = env.WHATSAPP_APP_SECRET
const FROM_NUMBER = '557499184184'
const command = process.argv[2] || '!ajuda'

const payload = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [{
    id: '2057219988296725',
    changes: [{
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '15551373961', phone_number_id: '1364440686752381' },
        contacts: [{ profile: { name: 'Luan' }, wa_id: FROM_NUMBER }],
        messages: [{
          from: FROM_NUMBER,
          id: 'wamid.test_' + Date.now(),
          timestamp: String(Math.floor(Date.now() / 1000)),
          text: { body: command },
          type: 'text'
        }]
      },
      field: 'messages'
    }]
  }]
})

const signature = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(payload).digest('hex')

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/whatsapp/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'x-hub-signature-256': signature,
    'x-test-mode': '1'
  }
}

console.log(`\nEnviando: "${command}"\n`)

const req = http.request(options, (res) => {
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    try {
      const json = JSON.parse(data)
      if (json.reply) {
        console.log('Bot respondeu:\n')
        console.log(json.reply)
        console.log()
      } else {
        console.log('Resposta:', data)
      }
    } catch {
      console.log('Resposta raw:', data)
    }
  })
})

req.on('error', (e) => {
  if (e.code === 'ECONNREFUSED') {
    console.error('Erro: servidor Next.js nao esta rodando. Execute "npm run dev" primeiro.')
  } else {
    console.error('Erro:', e.message)
  }
})

req.write(payload)
req.end()
