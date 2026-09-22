'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { resendCode } from './actions'

export function CheckEmailCard({ email }: { email: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleResend() {
    setStatus('sending')
    const result = await resendCode(email)
    setStatus(result.success ? 'sent' : 'error')
    setMessage(result.message)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">

        <div className="inline-flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded bg-primary/15 flex items-center justify-center">
            <span className="text-primary text-xs font-bold font-heading">ZR</span>
          </div>
          <span className="font-heading font-bold text-lg text-foreground">Zap da Roça</span>
        </div>

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Mail className="w-7 h-7 text-primary" />
          </div>
        </div>

        <h1 className="font-heading text-2xl font-bold text-foreground mb-3">
          Confirme seu e-mail
        </h1>

        <p className="text-sm text-muted-foreground leading-relaxed mb-2">
          Enviamos um link de confirmação para:
        </p>
        <p className="text-sm font-medium text-foreground mb-6">
          {email}
        </p>

        <div className="bg-card border border-border rounded-lg px-4 py-3 text-xs text-muted-foreground text-left mb-8">
          Clique no link do e-mail para ativar sua conta e acessar o portal.
          Verifique também a pasta de <strong className="text-foreground">spam</strong>.
        </div>

        {status === 'sent' && (
          <p className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-3 py-2 mb-4">
            {message}
          </p>
        )}
        {status === 'error' && (
          <p className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded px-3 py-2 mb-4">
            {message}
          </p>
        )}

        <p className="text-sm text-muted-foreground mb-1">
          Não recebeu o e-mail?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={status === 'sending' || status === 'sent'}
            className="text-primary hover:underline disabled:opacity-50"
          >
            {status === 'sending' ? 'Reenviando…' : 'Reenviar'}
          </button>
        </p>

        <p className="text-sm text-muted-foreground">
          <Link href="/entrar" className="text-primary hover:underline">
            Voltar para o login
          </Link>
        </p>

      </div>
    </div>
  )
}
