import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendDailyReminder, sendVerificationCode, sendWhatsAppMessage, sendWhatsAppTemplate } from './whatsapp'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, text: async () => '' })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('WHATSAPP_TOKEN', 'tok')
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '12345')
  vi.stubEnv('WHATSAPP_TEMPLATE_OTP', undefined)
  vi.stubEnv('WHATSAPP_TEMPLATE_REMINDER', undefined)
  vi.stubEnv('WHATSAPP_TEMPLATE_LANG', undefined)
})

afterEach(() => vi.unstubAllGlobals())

const sent = () => {
  const [url, init] = fetchMock.mock.calls[0]
  return { url: url as string, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) }
}

describe('sendWhatsAppMessage', () => {
  it('posts a text message to the Graph API with the bearer token', async () => {
    await sendWhatsAppMessage('5511999990001', 'oi')
    const { url, headers, body } = sent()
    expect(url).toBe('https://graph.facebook.com/v21.0/12345/messages')
    expect(headers.Authorization).toBe('Bearer tok')
    expect(body).toEqual({ messaging_product: 'whatsapp', to: '5511999990001', type: 'text', text: { body: 'oi' } })
  })

  it('surfaces API failures', async () => {
    fetchMock.mockResolvedValue({ ok: false, text: async () => '{"error":"nope"}' })
    await expect(sendWhatsAppMessage('1', 'x')).rejects.toThrow('WhatsApp API error')
  })

  it('refuses to run without credentials', async () => {
    vi.stubEnv('WHATSAPP_TOKEN', '')
    await expect(sendWhatsAppMessage('1', 'x')).rejects.toThrow('not configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('sendWhatsAppTemplate', () => {
  it('builds a template payload with body parameters and the default language', async () => {
    await sendWhatsAppTemplate('5511', 'lembrete', ['a', 'b'])
    expect(sent().body).toEqual({
      messaging_product: 'whatsapp',
      to: '5511',
      type: 'template',
      template: {
        name: 'lembrete',
        language: { code: 'pt_BR' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }],
      },
    })
  })

  it('adds the copy-code button parameter and honours WHATSAPP_TEMPLATE_LANG', async () => {
    vi.stubEnv('WHATSAPP_TEMPLATE_LANG', 'pt_PT')
    await sendWhatsAppTemplate('5511', 'otp', ['123456'], { buttonParam: '123456' })
    const { template } = sent().body
    expect(template.language.code).toBe('pt_PT')
    expect(template.components[1]).toEqual({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: '123456' }],
    })
  })
})

describe('sendVerificationCode', () => {
  it('falls back to plain text when no template is configured (dev / Meta test number)', async () => {
    await sendVerificationCode('5511', '654321')
    const { body } = sent()
    expect(body.type).toBe('text')
    expect(body.text.body).toContain('654321')
  })

  it('uses the approved authentication template in production', async () => {
    vi.stubEnv('WHATSAPP_TEMPLATE_OTP', 'zapdaroca_codigo')
    await sendVerificationCode('5511', '654321')
    const { body } = sent()
    expect(body.type).toBe('template')
    expect(body.template.name).toBe('zapdaroca_codigo')
    expect(body.template.components[0].parameters).toEqual([{ type: 'text', text: '654321' }])
    expect(body.template.components[1].parameters).toEqual([{ type: 'text', text: '654321' }])
  })
})

describe('sendDailyReminder', () => {
  const reminder = { date: '12/10/2026', items: ['#1 Diesel — R$ 120,00', '#2 Adubo — R$ 80,00'], total: 'R$ 200,00' }

  it('sends readable text without a template', async () => {
    await sendDailyReminder('5511', reminder)
    const { body } = sent()
    expect(body.type).toBe('text')
    expect(body.text.body).toContain('12/10/2026')
    expect(body.text.body).toContain('#1 Diesel')
    expect(body.text.body).toContain('R$ 200,00')
    expect(body.text.body).toContain('!pago')
  })

  it('sends one-line template parameters (Meta rejects line breaks in params)', async () => {
    vi.stubEnv('WHATSAPP_TEMPLATE_REMINDER', 'zapdaroca_lembrete')
    await sendDailyReminder('5511', reminder)
    const params = sent().body.template.components[0].parameters.map((p: { text: string }) => p.text)
    expect(params).toEqual(['12/10/2026', '#1 Diesel — R$ 120,00 | #2 Adubo — R$ 80,00', 'R$ 200,00'])
    expect(params.some((p: string) => p.includes('\n'))).toBe(false)
  })
})
