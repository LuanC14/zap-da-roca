'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from './actions'

export default function EsqueciSenhaPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined)

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
          <h1 className="font-heading text-2xl font-bold text-foreground">Esqueci minha senha</h1>
          <p className="text-sm text-muted-foreground mt-1">Enviaremos um link para você criar uma nova senha</p>
        </div>

        {state?.sent ? (
          <div role="status" className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-400">
            Se existir uma conta com esse e-mail, o link já está a caminho. Verifique também a caixa de spam. O link vale por tempo limitado.
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                E-mail da conta
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full bg-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="seu@email.com"
              />
            </div>

            {state?.error && (
              <p role="alert" className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded px-3 py-2">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-primary text-primary-foreground font-medium rounded-md py-2.5 text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {pending ? 'Enviando…' : 'Enviar link'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link href="/entrar" className="text-primary hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  )
}
