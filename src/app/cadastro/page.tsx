'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { register } from './actions'

export default function CadastroPage() {
  const [state, action, pending] = useActionState(register, undefined)

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
          <h1 className="font-heading text-2xl font-bold text-foreground">Criar conta</h1>
          <p className="text-sm text-muted-foreground mt-1">
            7 dias grátis, sem cartão
          </p>
        </div>

        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-foreground mb-1.5">
              Seu nome
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              required
              className="w-full bg-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              placeholder="João da Silva"
            />
            {state?.errors?.full_name && (
              <p className="text-xs text-rose-400 mt-1">{state.errors.full_name[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="farm_name" className="block text-sm font-medium text-foreground mb-1.5">
              Nome da fazenda / propriedade
            </label>
            <input
              id="farm_name"
              name="farm_name"
              type="text"
              required
              className="w-full bg-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              placeholder="Fazenda Santa Cruz"
            />
            {state?.errors?.farm_name && (
              <p className="text-xs text-rose-400 mt-1">{state.errors.farm_name[0]}</p>
            )}
          </div>

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
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="w-full bg-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              placeholder="Mínimo 8 caracteres"
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
            className="w-full bg-primary text-primary-foreground font-medium rounded-md py-2.5 text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors mt-2"
          >
            {pending ? 'Criando conta…' : 'Começar 7 dias grátis'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Já tem conta?{' '}
          <Link href="/entrar" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
