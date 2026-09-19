import { supabaseAdmin } from '@/lib/supabase'
import { currentMonthRange, formatBrazilian, todayISO } from '@/lib/parsers/date-parser'
import { formatCurrency } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Painel Geral</h1>
        <p className="text-muted-foreground text-sm">Período: {kpis.period}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Receitas" value={formatCurrency(kpis.income)} icon="💚" color="text-green-700" />
        <KpiCard title="Despesas" value={formatCurrency(kpis.expenses)} icon="🔴" color="text-red-600" />
        <KpiCard
          title="Saldo"
          value={formatCurrency(kpis.balance)}
          icon={kpis.balance >= 0 ? '✅' : '⚠️'}
          color={kpis.balance >= 0 ? 'text-green-700' : 'text-red-600'}
        />
        <KpiCard title="Mão de Obra" value={formatCurrency(kpis.laborCost)} icon="👷" color="text-amber-700" />
      </div>

      {/* Contas de hoje */}
      {kpis.pendingToday.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-800">
              ⏰ Contas para pagar hoje ({kpis.pendingToday.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {kpis.pendingToday.map((t: { id: number; description: string | null; amount: number; categories: unknown }) => (
                <li key={t.id} className="flex justify-between text-sm">
                  <span>#{t.id} {t.description ?? (t.categories as { name: string })?.name}</span>
                  <span className="font-medium text-red-600">{formatCurrency(t.amount)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Lançamentos recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lançamentos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum lançamento ainda. Use o bot no WhatsApp para registrar.</p>
          ) : (
            <ul className="divide-y">
              {recent.map((t: { id: number; type: string; amount: number; description: string | null; transaction_date: string; paid: boolean; categories: unknown }) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{t.type === 'income' ? '💚' : '🔴'}</span>
                    <div>
                      <div>{t.description ?? (t.categories as { name: string })?.name}</div>
                      <div className="text-xs text-muted-foreground">{formatBrazilian(t.transaction_date)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={t.type === 'income' ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </span>
                    <Badge variant={t.paid ? 'secondary' : 'outline'} className="text-xs">
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

function KpiCard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <span>{icon}</span>
          <span>{title}</span>
        </div>
        <div className={`text-xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
