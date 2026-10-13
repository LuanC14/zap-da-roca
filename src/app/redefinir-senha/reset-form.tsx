'use client'

import { useActionState } from 'react'
import { updatePassword } from './actions'

const inputClass =
  'w-full bg-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors'

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined)

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">Nova senha</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8}
          className={inputClass} placeholder="Mínimo 8 caracteres" />
      </div>
      <div>
        <label htmlFor="confirm_password" className="block text-sm font-medium text-foreground mb-1.5">Confirmar nova senha</label>
        <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required minLength={8}
          className={inputClass} placeholder="Repita a senha" />
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
        {pending ? 'Salvando…' : 'Salvar nova senha'}
      </button>
    </form>
  )
}
