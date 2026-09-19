import { supabaseAdmin } from '@/lib/supabase'
import { currentMonthRange, formatBrazilian } from '@/lib/parsers/date-parser'
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
  const start = params.start ?? range.start
  const end = params.end ?? range.end

  const [{ data: transactions }, { data: workRecords }, { data: employees }] = await Promise.all([
    supabaseAdmin
      .from('transactions')
      .select('type, amount, categories(name)')
      .gte('transaction_date', start)
      .lte('transaction_date', end),
    supabaseAdmin
      .from('work_records')
      .select('daily_rate_snapshot, overtime_hours, overtime_rate_snapshot, employees(name)')
      .gte('work_date', start)
      .lte('work_date', end),
    supabaseAdmin.from('employees').select('id, name').eq('active', true),
  ])

  const income = (transactions ?? []).filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = (transactions ?? []).filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // Expenses by category
  const byCategory: Record<string, number> = {}
  for (const t of (transactions ?? []).filter((t) => t.type === 'expense')) {
    const cat = (t.categories as unknown as { name: string } | null)?.name ?? 'Sem categoria'
    byCategory[cat] = (byCategory[cat] ?? 0) + t.amount
  }

  // Labor cost by employee
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground text-sm">
          Período: {formatBrazilian(start)} a {formatBrazilian(end)}
        </p>
      </div>

      {/* Resumo geral */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '💚 Receitas', value: formatCurrency(income), color: 'text-green-700' },
          { label: '🔴 Despesas', value: formatCurrency(expenses), color: 'text-red-600' },
          { label: '💰 Saldo', value: formatCurrency(income - expenses), color: income - expenses >= 0 ? 'text-green-700' : 'text-red-600' },
          { label: '👷 Mão de Obra', value: formatCurrency(totalLabor), color: 'text-amber-700' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-5">
              <div className="text-xs text-muted-foreground mb-1">{kpi.label}</div>
              <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Despesas por categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(byCategory).length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma despesa no período.</p>
            ) : (
              <ul className="space-y-2">
                {Object.entries(byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, total]) => (
                    <li key={cat} className="flex justify-between text-sm">
                      <span>{cat}</span>
                      <span className="font-medium text-red-600">{formatCurrency(total)}</span>
                    </li>
                  ))}
                <Separator className="my-2" />
                <li className="flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span className="text-red-700">{formatCurrency(expenses)}</span>
                </li>
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Custo de mão de obra por funcionário */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mão de Obra por Funcionário</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(byEmployee).length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum registro de ponto no período.</p>
            ) : (
              <ul className="space-y-2">
                {Object.values(byEmployee)
                  .sort((a, b) => b.total - a.total)
                  .map((e) => (
                    <li key={e.name} className="text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{e.name}</span>
                        <span className="font-medium text-amber-700">{formatCurrency(e.total)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.days} diária(s) + {formatCurrency(e.extraCost)} extras
                      </div>
                    </li>
                  ))}
                <Separator className="my-2" />
                <li className="flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span className="text-amber-700">{formatCurrency(totalLabor)}</span>
                </li>
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
