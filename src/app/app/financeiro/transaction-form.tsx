'use client'

import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { createTransaction, deleteTransactionAction, settleTransactionAction } from './actions'

export interface CategoryOption {
  id: string
  name: string
  type: 'expense' | 'income' | 'both'
}

const inputClass =
  'w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors'

export function TransactionForm({ categories, today }: { categories: CategoryOption[]; today: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const options = categories.filter((c) => c.type === type || c.type === 'both')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createTransaction(fd)
      if (res.error) return setError(res.error)
      formRef.current?.reset()
      setType('expense')
      setSaved(true)
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.5fr_1fr]">
        <div>
          <label htmlFor="tx-type" className="block text-xs text-muted-foreground mb-1">Tipo</label>
          <select id="tx-type" name="type" value={type} onChange={(e) => setType(e.target.value as 'expense' | 'income')} className={inputClass}>
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </select>
        </div>
        <div>
          <label htmlFor="tx-amount" className="block text-xs text-muted-foreground mb-1">Valor (R$)</label>
          <input id="tx-amount" name="amount" required inputMode="decimal" placeholder="350,00" className={inputClass} />
        </div>
        <div>
          <label htmlFor="tx-category" className="block text-xs text-muted-foreground mb-1">Categoria</label>
          <select id="tx-category" name="category_id" defaultValue="" key={type} className={inputClass}>
            <option value="">Sem categoria</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tx-date" className="block text-xs text-muted-foreground mb-1">Data</label>
          <input id="tx-date" name="date" type="date" required defaultValue={today} className={inputClass} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div>
          <label htmlFor="tx-description" className="block text-xs text-muted-foreground mb-1">Descrição (opcional)</label>
          <input id="tx-description" name="description" maxLength={120} placeholder="Abastecimento do trator" className={inputClass} />
        </div>
        <label htmlFor="tx-paid" className="flex items-center gap-2 text-sm text-foreground py-2">
          <input id="tx-paid" name="paid" type="checkbox" className="h-4 w-4 accent-primary" />
          Já está pago
        </label>
        <Button type="submit" size="sm" disabled={isPending}>Lançar</Button>
      </div>

      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      {saved && <p role="status" className="text-xs text-emerald-400">Lançamento salvo.</p>}
    </form>
  )
}

export function TransactionRowActions({ id, paid }: { id: number; paid: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function run(action: (id: number) => Promise<{ error?: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await action(id)
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {!paid && (
          <Button type="button" variant="outline" size="sm" className="text-xs" disabled={isPending} onClick={() => run(settleTransactionAction)}>
            Quitar
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs"
          disabled={isPending}
          onClick={() => {
            if (window.confirm(`Excluir o lançamento #${id}? Esta ação não pode ser desfeita.`)) run(deleteTransactionAction)
          }}
        >
          Excluir
        </Button>
      </div>
      {error && <p role="alert" className="text-[11px] text-rose-400 max-w-48">{error}</p>}
    </div>
  )
}
