import { createClient } from '@/lib/supabase/server'
import { currentMonthRange, formatBrazilian, isISODate } from '@/lib/parsers/date-parser'
import { formatCurrency } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>
}) {
  const params = await searchParams
  const range = currentMonthRange()
  const start = isISODate(params.start) ? params.start : range.start
  const end = isISODate(params.end) ? params.end : range.end
  const supabase = await createClient()

  const [{ data: transactions }, { data: workRecords }] = await Promise.all([
    supabase
      .from('transactions')
      .select('type, amount, categories(name)')
      .gte('transaction_date', start)
      .lte('transaction_date', end),
    supabase
      .from('work_records')
      .select('daily_rate_snapshot, overtime_hours, overtime_rate_snapshot, employees(name)')
      .gte('work_date', start)
      .lte('work_date', end),
  ])

  const income = (transactions ?? []).filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = (transactions ?? []).filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const byCategory: Record<string, number> = {}
  for (const t of (transactions ?? []).filter((t) => t.type === 'expense')) {
    const cat = (t.categories as unknown as { name: string } | null)?.name ?? 'Sem categoria'
    byCategory[cat] = (byCategory[cat] ?? 0) + t.amount
  }

  const byEmployee: Record<string, { name: string; days: number; extraCost: number; total: number }> = {}
  for (const r of workRecords ?? []) {
    const name = (r.employees as unknown as { name: string } | null)?.name ?? 'Desconhecido'
    if (!byEmployee[name]) byEmployee[name] = { name, days: 0, extraCost: 0, total: 0 }
    if (r.daily_rate_snapshot > 0) byEmployee[name].days += 1
    const extra = r.overtime_hours * r.overtime_rate_snapshot
    byEmployee[name].extraCost += extra
    byEmployee[name].total += r.daily_rate_snapshot + extra
  }
  const totalLabor = Object.values(byEmployee).reduce((s, e) => s + e.total, 0)

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Análise</p>
          <h1 className="text-3xl font-bold font-heading text-foreground">Relatórios</h1>
        </div>
        <p className="text-xs text-muted-foreground pb-1">
          {formatBrazilian(start)} a {formatBrazilian(end)}
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Receitas',    value: formatCurrency(income),              color: 'text-emerald-400', border: 'border-emerald-400' },
          { label: 'Despesas',    value: formatCurrency(expenses),            color: 'text-rose-400',    border: 'border-rose-400' },
          { label: 'Saldo',       value: formatCurrency(income - expenses),   color: income - expenses >= 0 ? 'text-emerald-400' : 'text-rose-400', border: income - expenses >= 0 ? 'border-emerald-400' : 'border-rose-400' },
          { label: 'Mão de Obra', value: formatCurrency(totalLabor),          color: 'text-amber-400',   border: 'border-amber-400' },
        ].map((kpi) => (
          <Card key={kpi.label} className={`border-t-2 ${kpi.border}`}>
            <CardContent className="pt-5 pb-5">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{kpi.label}</div>
              <div className={`text-2xl font-bold font-heading tabular ${kpi.color}`}>{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* Despesas por categoria */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(byCategory).length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">Nenhuma despesa no período.</p>
            ) : (
              <ul className="space-y-2.5">
                {Object.entries(byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, total]) => (
                    <li key={cat} className="flex justify-between items-center text-sm">
                      <span className="text-foreground">{cat}</span>
                      <span className="tabular font-semibold text-rose-400">{formatCurrency(total)}</span>
                    </li>
                  ))}
                <Separator className="my-3 bg-border" />
                <li className="flex justify-between items-center text-sm font-bold">
                  <span className="text-muted-foreground uppercase tracking-wider text-xs">Total</span>
                  <span className="tabular text-rose-400">{formatCurrency(expenses)}</span>
                </li>
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Mão de obra por funcionário */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Mão de Obra por Funcionário
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(byEmployee).length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">Nenhum registro de ponto no período.</p>
            ) : (
              <ul className="space-y-3">
                {Object.values(byEmployee)
                  .sort((a, b) => b.total - a.total)
                  .map((e) => (
                    <li key={e.name}>
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium">{e.name}</span>
                        <span className="tabular font-semibold text-amber-400">{formatCurrency(e.total)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {e.days} diária{e.days !== 1 ? 's' : ''} · {formatCurrency(e.extraCost)} extras
                      </div>
                    </li>
                  ))}
                <Separator className="my-3 bg-border" />
                <li className="flex justify-between items-center text-sm font-bold">
                  <span className="text-muted-foreground uppercase tracking-wider text-xs">Total</span>
                  <span className="tabular text-amber-400">{formatCurrency(totalLabor)}</span>
                </li>
              </ul>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
