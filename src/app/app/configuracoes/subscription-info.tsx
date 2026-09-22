'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { cancelSubscription } from './actions'

type Status = 'trial' | 'active' | 'past_due' | 'paused' | 'cancelled'

const STATUS_LABEL: Record<Status, string> = {
  trial:      'Período de avaliação',
  active:     'Plano Básico',
  past_due:   'Pagamento pendente',
  paused:     'Assinatura pausada',
  cancelled:  'Assinatura cancelada',
}

const STATUS_CLASSES: Record<Status, string> = {
  trial:      'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
  active:     'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  past_due:   'text-amber-400 border-amber-400/30 bg-amber-400/10',
  paused:     'text-orange-400 border-orange-400/30 bg-orange-400/10',
  cancelled:  'text-rose-400 border-rose-400/30 bg-rose-400/10',
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
}

type Props = {
  status: Status
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  hasSubscriptionId: boolean
}

export function SubscriptionInfo({ status, trialEndsAt, currentPeriodEnd, hasSubscriptionId }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canCancel = hasSubscriptionId && (status === 'active' || status === 'past_due' || status === 'paused')

  async function handleCancel() {
    setLoading(true)
    setError('')
    const result = await cancelSubscription()
    if (result.error) {
      setError(result.error)
      setLoading(false)
      setConfirming(false)
    }
    // On success, revalidatePath refreshes the server component data
  }

  let dateLabel: string | null = null
  if (status === 'trial' && trialEndsAt) {
    dateLabel = `Avaliação encerra em ${formatDate(trialEndsAt)}`
  } else if ((status === 'active' || status === 'past_due') && currentPeriodEnd) {
    dateLabel = status === 'active'
      ? `Próxima cobrança: ${formatDate(currentPeriodEnd)}`
      : `Vencido em ${formatDate(currentPeriodEnd)}`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={`text-[10px] uppercase tracking-wider px-1.5 ${STATUS_CLASSES[status]}`}
            >
              {STATUS_LABEL[status]}
            </Badge>
            {status === 'active' && (
              <span className="text-xs text-muted-foreground">R$29,90/mês</span>
            )}
          </div>
          {dateLabel && (
            <p className="text-xs text-muted-foreground">{dateLabel}</p>
          )}
        </div>

        {status === 'trial' && (
          <Link href="/assinar" className={buttonVariants({ size: 'sm' })}>
            Assinar
          </Link>
        )}

        {canCancel && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-xs text-muted-foreground hover:text-rose-400 transition-colors shrink-0"
          >
            Cancelar assinatura
          </button>
        )}
      </div>

      {confirming && (
        <div className="rounded-md border border-rose-400/20 bg-rose-400/5 px-3 py-3 space-y-2">
          <p className="text-xs text-rose-300">
            Tem certeza? Você perderá acesso ao portal ao fim do período atual.
          </p>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs"
              disabled={loading}
              onClick={handleCancel}
            >
              {loading ? 'Cancelando…' : 'Confirmar cancelamento'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={loading}
              onClick={() => { setConfirming(false); setError('') }}
            >
              Voltar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
