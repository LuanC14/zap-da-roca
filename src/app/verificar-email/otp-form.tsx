'use client'

import { useRef, useState, useActionState } from 'react'
import { verifyEmail, resendCode } from './actions'

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const visible = local.slice(0, 2)
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 3))}@${domain}`
}

export function OtpForm({ email }: { email: string }) {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [resendMessage, setResendMessage] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const token = digits.join('')

  const [state, action, pending] = useActionState(verifyEmail, undefined)

  function handleDigitChange(idx: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[idx] = digit
    setDigits(next)
    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus()
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = [...digits]
        next[idx] = ''
        setDigits(next)
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus()
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = Array(6).fill('')
    pasted.split('').forEach((ch, i) => { next[i] = ch })
    setDigits(next)
    const focusIdx = Math.min(pasted.length, 5)
    inputRefs.current[focusIdx]?.focus()
  }

  async function handleResend() {
    setResendStatus('sending')
    const result = await resendCode(email)
    setResendStatus(result.success ? 'sent' : 'error')
    setResendMessage(result.message)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded bg-primary/15 flex items-center justify-center">
              <span className="text-primary text-xs font-bold font-heading">ZR</span>
            </div>
            <span className="font-heading font-bold text-lg text-foreground">Zap da Roça</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Confirme seu e-mail</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Enviamos um código de 6 dígitos para{' '}
            <span className="text-foreground font-medium">{maskEmail(email)}</span>
          </p>
        </div>

        <form action={action} className="space-y-6">
          <input type="hidden" name="email" value={email} readOnly />
          <input type="hidden" name="token" value={token} readOnly />

          <div>
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-11 h-14 text-center text-2xl font-mono font-bold bg-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-foreground"
                />
              ))}
            </div>

            {state?.message && (
              <p className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded px-3 py-2 mt-4 text-center">
                {state.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={pending || token.length < 6}
            className="w-full bg-primary text-primary-foreground font-medium rounded-md py-2.5 text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {pending ? 'Verificando…' : 'Confirmar'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {resendStatus === 'idle' || resendStatus === 'error' ? (
            <>
              Não recebeu o código?{' '}
              <button
                type="button"
                onClick={handleResend}
                className="text-primary hover:underline"
              >
                Reenviar
              </button>
            </>
          ) : resendStatus === 'sending' ? (
            <span>Reenviando…</span>
          ) : (
            <span className="text-emerald-400">{resendMessage}</span>
          )}

          {resendStatus === 'error' && resendMessage && (
            <p className="text-xs text-rose-400 mt-1">{resendMessage}</p>
          )}
        </div>
      </div>
    </div>
  )
}
