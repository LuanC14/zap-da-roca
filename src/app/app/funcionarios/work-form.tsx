'use client'

import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { registerWork } from './actions'

const inputClass =
  'w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors'

export function WorkForm({ employees, today }: { employees: { id: string; name: string }[]; today: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [kind, setKind] = useState<'ponto' | 'extra'>('ponto')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await registerWork(fd)
      if (res.error) return setError(res.error)
      setMessage(res.message ?? 'Registrado.')
      formRef.current?.reset()
      setKind('ponto')
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="work-employee" className="block text-xs text-muted-foreground mb-1">Funcionário</label>
          <select id="work-employee" name="employee_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>Selecione</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="work-kind" className="block text-xs text-muted-foreground mb-1">Registro</label>
          <select id="work-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as 'ponto' | 'extra')} className={inputClass}>
            <option value="ponto">Diária</option>
            <option value="extra">Hora extra</option>
          </select>
        </div>
        <div>
          <label htmlFor="work-date" className="block text-xs text-muted-foreground mb-1">Data</label>
          <input id="work-date" name="date" type="date" required defaultValue={today} className={inputClass} />
        </div>
        <div>
          <label htmlFor="work-hours" className="block text-xs text-muted-foreground mb-1">Horas</label>
          <input id="work-hours" name="hours" inputMode="decimal" placeholder="2" disabled={kind !== 'extra'} required={kind === 'extra'} className={`${inputClass} disabled:opacity-40`} />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>Registrar</Button>
      </div>
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      {message && <p role="status" className="text-xs text-emerald-400">{message}</p>}
    </form>
  )
}
