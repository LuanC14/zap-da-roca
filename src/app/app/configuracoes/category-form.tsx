'use client'

import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { createCategory, deleteCategory } from './actions'

const inputClass =
  'w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors'

export function CategoryForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createCategory(fd)
      if (res.error) return setError(res.error)
      formRef.current?.reset()
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-4 space-y-2">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="cat-name" className="block text-xs text-muted-foreground mb-1">Nova categoria</label>
          <input id="cat-name" name="name" required minLength={2} maxLength={40} placeholder="Veterinário" className={inputClass} />
        </div>
        <div>
          <label htmlFor="cat-type" className="block text-xs text-muted-foreground mb-1">Tipo</label>
          <select id="cat-type" name="type" defaultValue="expense" className={inputClass}>
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
            <option value="both">Ambos</option>
          </select>
        </div>
        <Button type="submit" size="sm" disabled={isPending}>Adicionar</Button>
      </div>
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      <p className="text-xs text-muted-foreground">
        No WhatsApp, use uma parte do nome:{' '}
        <code className="bg-muted px-1.5 py-0.5 rounded text-primary text-[11px]">!pagar 80 veterinario vacina</code>
      </p>
    </form>
  )
}

export function CategoryDeleteButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function remove() {
    setError(null)
    startTransition(async () => {
      const res = await deleteCategory(id)
      if (res.error) setError(res.error)
    })
  }

  return (
    <div>
      <Button type="button" variant="outline" size="sm" className="text-xs" onClick={remove} disabled={isPending}>
        Remover
      </Button>
      {error && <p role="alert" className="text-[11px] text-rose-400 mt-1 max-w-48">{error}</p>}
    </div>
  )
}
