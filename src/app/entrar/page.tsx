'use client'

import { Suspense, useActionState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { login } from './actions'

function LinkError() {
  const params = useSearchParams()
  if (params.get('erro') !== 'link') return null
  return (
    <p role="alert" className="mb-4 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-400">
      Link inválido ou expirado. Entre com seu e-mail e senha — se esqueceu a senha, use &quot;Esqueci minha senha&quot; para receber um novo link.
    </p>
  )
}

export default function EntrarPage() {
  const [state, action, pending] = useActionState(login, undefined)

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
          <h1 className="font-heading text-2xl font-bold text-foreground">Entrar na conta</h1>
          <p className="text-sm text-muted-foreground mt-1">Acesse o painel da sua fazenda</p>
        </div>

        <Suspense fallback={null}>
          <LinkError />
        </Suspense>

        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
              E-mail
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
            {state?.errors?.email && (
              <p className="text-xs text-rose-400 mt-1">{state.errors.email[0]}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Senha
              </label>
              <Link href="/esqueci-senha" className="text-xs text-primary hover:underline">
                Esqueci minha senha
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full bg-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              placeholder="••••••••"
            />
            {state?.errors?.password && (
              <p className="text-xs text-rose-400 mt-1">{state.errors.password[0]}</p>
            )}
          </div>

          {state?.message && (
            <p className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded px-3 py-2">
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-primary text-primary-foreground font-medium rounded-md py-2.5 text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {pending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Não tem conta?{' '}
          <Link href="/cadastro" className="text-primary hover:underline">
            Cadastre-se grátis
          </Link>
        </p>
      </div>
    </div>
  )
}
