'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { sendPhoneVerification, verifyPhoneCode, unlinkPhone } from './actions'

interface Props {
  linkedPhone: string | null
}

export function WhatsAppLinkForm({ linkedPhone }: Props) {
  const [step, setStep] = useState<'idle' | 'sent' | 'done'>(linkedPhone ? 'done' : 'idle')
  const [phone, setPhone] = useState(linkedPhone ? formatDisplay(linkedPhone) : '')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await sendPhoneVerification(fd)
      if (res.error) return setError(res.error)
      setStep('sent')
    })
  }

  function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await verifyPhoneCode(fd)
      if (res.error) return setError(res.error)
      setStep('done')
    })
  }

  function handleUnlink() {
    setError(null)
    startTransition(async () => {
      const res = await unlinkPhone()
      if (res.error) return setError(res.error)
      setPhone('')
      setCode('')
      setStep('idle')
    })
  }

  if (step === 'done') {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{formatDisplay(phone)}</p>
          <p className="text-xs text-emerald-400 mt-0.5">✓ Número verificado</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={handleUnlink}
          disabled={isPending}
        >
          Desvincular
        </Button>
      </div>
    )
  }

  if (step === 'sent') {
    return (
      <form onSubmit={handleVerify} className="space-y-3">
        <input type="hidden" name="phone" value={phone} />
        <p className="text-xs text-muted-foreground">
          Enviamos um código de 6 dígitos para <span className="text-foreground font-medium">{formatDisplay(phone)}</span>. Verifique o WhatsApp.
        </p>
        <div className="flex gap-2">
          <input
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm text-center tracking-[0.3em] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={isPending || code.length < 6}>
            {isPending ? 'Verificando…' : 'Confirmar'}
          </Button>
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          onClick={() => { setStep('idle'); setError(null) }}
        >
          Usar outro número
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSend} className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Informe seu número do WhatsApp para ativar o bot. Enviaremos um código de verificação.
      </p>
      <div className="flex gap-2">
        <input
          name="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(11) 99999-9999"
          className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          autoFocus
        />
        <Button type="submit" size="sm" disabled={isPending || !phone.trim()}>
          {isPending ? 'Enviando…' : 'Enviar código'}
        </Button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </form>
  )
}

function formatDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // 5511999999999 → +55 (11) 99999-9999
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4)
    const num = digits.slice(4)
    const part1 = num.slice(0, num.length - 4)
    const part2 = num.slice(-4)
    return `+55 (${ddd}) ${part1}-${part2}`
  }
  return phone
}
