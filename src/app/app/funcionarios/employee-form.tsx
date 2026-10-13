'use client'

import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { createEmployee, setEmployeeActive, updateEmployee } from './actions'

export interface EmployeeFields {
  id: string
  name: string
  daily_rate: number
  overtime_rate: number
  active: boolean
}

const inputClass =
  'w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors'

const toField = (n: number) => String(n).replace('.', ',')

export function EmployeeForm({ employee }: { employee?: EmployeeFields }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const prefix = employee ? `emp-${employee.id}` : 'emp-new'

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = employee ? await updateEmployee(fd) : await createEmployee(fd)
      if (res.error) return setError(res.error)
      if (!employee) formRef.current?.reset()
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor={`${prefix}-name`} className="block text-xs text-muted-foreground mb-1">Nome</label>
          <input id={`${prefix}-name`} name="name" required minLength={2} maxLength={80}
            defaultValue={employee?.name} placeholder="João da Silva" className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${prefix}-daily`} className="block text-xs text-muted-foreground mb-1">Diária (R$)</label>
          <input id={`${prefix}-daily`} name="daily_rate" required inputMode="decimal"
            defaultValue={employee ? toField(employee.daily_rate) : undefined} placeholder="120,00" className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${prefix}-ot`} className="block text-xs text-muted-foreground mb-1">Hora extra (R$/h)</label>
          <input id={`${prefix}-ot`} name="overtime_rate" required inputMode="decimal"
            defaultValue={employee ? toField(employee.overtime_rate) : undefined} placeholder="15,00" className={inputClass} />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {employee ? 'Salvar' : 'Cadastrar'}
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
    </form>
  )
}

export function EmployeeActions({ employee }: { employee: EmployeeFields }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    setError(null)
    startTransition(async () => {
      const res = await setEmployeeActive(employee.id, !employee.active)
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <details className="group">
          <summary className="cursor-pointer text-xs text-primary hover:underline list-none">Editar</summary>
          <div className="mt-2 min-w-[28rem] rounded-md border border-border bg-muted/30 p-3">
            <EmployeeForm employee={employee} />
          </div>
        </details>
        <Button type="button" variant="outline" size="sm" className="text-xs" onClick={toggle} disabled={isPending}>
          {employee.active ? 'Desativar' : 'Reativar'}
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
    </div>
  )
}
