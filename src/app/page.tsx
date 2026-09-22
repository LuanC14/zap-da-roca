import { supabaseAdmin } from '@/lib/supabase'
import { currentMonthRange, formatBrazilian, todayISO } from '@/lib/parsers/date-parser'
import { formatCurrency } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Wallet, HardHat, AlertCircle, type LucideIcon } from 'lucide-react'

async function getKPIs() {
  const { start, end } = currentMonthRange()
  const today = todayISO()

  const [{ data: transactions }, { data: workRecords }, { data: pending }] = await Promise.all([
    supabaseAdmin
      .from('transactions')
      .select('type, amount')
      .gte('transaction_date', start)
      .lte('transaction_date', end),
    supabaseAdmin
      .from('work_records')
      .select('daily_rate_snapshot, overtime_hours, overtime_rate_snapshot')
      .gte('work_date', start)
      .lte('work_date', end),
    supabaseAdmin
      .from('transactions')
      .select('id, description, amount, categories(name)')
      .eq('transaction_date', today)
      .eq('paid', false)
      .eq('type', 'expense'),
  ])

  const income = (transactions ?? []).filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = (transactions ?? []).filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const laborCost = (workRecords ?? []).reduce(
    (s, r) => s + r.daily_rate_snapshot + r.overtime_hours * r.overtime_rate_snapshot,
    0
  )

  return {
    income,
    expenses,
    balance: income - expenses,
    laborCost,
    pendingToday: pending ?? [],
    period: `${formatBrazilian(start)} a ${formatBrazilian(end)}`,
  }
}

async function getRecentTransactions() {
  const { data } = await supabaseAdmin
    .from('transactions')
    .select('id, type, amount, description, transaction_date, paid, categories(name)')
    .order('created_at', { ascending: false })
    .limit(5)
  return data ?? []
}

export default async function HomePage() {
  const [kpis, recent] = await Promise.all([getKPIs(), getRecentTransactions()])

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Visão Geral</p>
          <h1 className="text-3xl font-bold font-heading text-foreground">Painel</h1>
        </div>
        <p className="text-xs text-muted-foreground pb-1">{kpis.period}</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Receitas"
          value={formatCurrency(kpis.income)}
          icon={TrendingUp}
          accentClass="border-t-2 border-emerald-400"
          valueClass="text-emerald-400"
        />
        <KpiCard
          title="Despesas"
          value={formatCurrency(kpis.expenses)}
          icon={TrendingDown}
          accentClass="border-t-2 border-rose-400"
          valueClass="text-rose-400"
        />
        <KpiCard
          title="Saldo"
          value={formatCurrency(kpis.balance)}
          icon={Wallet}
          accentClass={`border-t-2 ${kpis.balance >= 0 ? 'border-emerald-400' : 'border-rose-400'}`}
          valueClass={kpis.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <KpiCard
          title="Mão de Obra"
          value={formatCurrency(kpis.laborCost)}
          icon={HardHat}
          accentClass="border-t-2 border-amber-400"
          valueClass="text-amber-400"
        />
      </div>

      {/* Contas de hoje */}
      {kpis.pendingToday.length > 0 && (
        <Card className="border border-amber-400/20 bg-amber-400/5">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-amber-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Contas para pagar hoje — {kpis.pendingToday.length} pendente{kpis.pendingToday.length > 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ul className="space-y-1.5">
              {kpis.pendingToday.map((t: { id: number; description: string | null; amount: number; categories: unknown }) => (
                <li key={t.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    #{t.id} · {t.description ?? (t.categories as { name: string })?.name}
                  </span>
                  <span className="tabular font-medium text-rose-400">{formatCurrency(t.amount)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Lançamentos recentes */}
      <Card className="glow-cyan">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Lançamentos Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              Nenhum lançamento. Use o bot no WhatsApp para registrar.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((t: { id: number; type: string; amount: number; description: string | null; transaction_date: string; paid: boolean; categories: unknown }) => (
                <li key={t.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.type === 'income' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    <div>
                      <div className="text-foreground">
                        {t.description ?? (t.categories as { name: string })?.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{formatBrazilian(t.transaction_date)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`tabular font-semibold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
                    </span>
                    <Badge
                      variant={t.paid ? 'secondary' : 'outline'}
                      className={`text-[10px] uppercase tracking-wider px-1.5 ${t.paid ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-muted-foreground'}`}
                    >
                      {t.paid ? 'Pago' : 'Pendente'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

    </div>
  )
}

function KpiCard({
  title,
  value,
  icon: Icon,
  accentClass,
  valueClass,
}: {
  title: string
  value: string
  icon: LucideIcon
  accentClass: string
  valueClass: string
}) {
  return (
    <Card className={accentClass}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3">
          <Icon className="h-3.5 w-3.5" />
          <span className="uppercase tracking-wider font-medium">{title}</span>
        </div>
        <div className={`text-2xl font-bold font-heading tabular ${valueClass}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
