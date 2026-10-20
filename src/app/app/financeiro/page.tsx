import { createClient } from '@/lib/supabase/server'
import { formatBrazilian, parseYearMonth, todayISO } from '@/lib/parsers/date-parser'
import { formatCurrency } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TransactionForm, TransactionRowActions, type CategoryOption } from './transaction-form'

const LIST_LIMIT = 100
const QUERY_CAP = 1000 // PostgREST max_rows

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; month?: string }>
}) {
  const params = await searchParams
  const type = params.type ?? ''
  const month = params.month ?? ''

  const supabase = await createClient()
  let query = supabase
    .from('transactions')
    .select('id, type, amount, description, transaction_date, paid, paid_at, categories(name)')
    .order('transaction_date', { ascending: false })
    .limit(QUERY_CAP)

  if (type === 'expense' || type === 'income') {
    query = query.eq('type', type)
  }
  const range = parseYearMonth(month)
  if (range) {
    query = query.gte('transaction_date', range.start).lte('transaction_date', range.end)
  }

  const { data } = await query
  const { data: categoryRows } = await supabase.from('categories').select('id, name, type').order('name')
  const categories = (categoryRows ?? []) as CategoryOption[]
  const transactions = data ?? []
  const shown = transactions.slice(0, LIST_LIMIT)
  const capped = transactions.length >= QUERY_CAP
  const activeMonth = parseYearMonth(month) ? month : ''
  const activeType = type === 'expense' || type === 'income' ? type : ''

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = totalIncome - totalExpense

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Controle</p>
        <h1 className="text-3xl font-bold font-heading text-foreground">Financeiro</h1>
      </div>

      {/* New transaction */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Novo lançamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm categories={categories} today={todayISO()} />
        </CardContent>
      </Card>

      {/* Filters */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="filter-month" className="block text-xs text-muted-foreground mb-1">Mês</label>
          <input id="filter-month" name="month" type="month" defaultValue={activeMonth}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
        </div>
        <div>
          <label htmlFor="filter-type" className="block text-xs text-muted-foreground mb-1">Tipo</label>
          <select id="filter-type" name="type" defaultValue={activeType}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary">
            <option value="">Todos</option>
            <option value="expense">Despesas</option>
            <option value="income">Receitas</option>
          </select>
        </div>
        <button type="submit" className="bg-primary text-primary-foreground text-sm font-medium rounded-md px-4 py-2 hover:bg-primary/90 transition-colors">
          Filtrar
        </button>
        {(activeMonth || activeType) && (
          <a href="/app/financeiro" className="text-xs text-muted-foreground hover:text-foreground py-2">Limpar</a>
        )}
      </form>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-t-2 border-emerald-400">
          <CardContent className="pt-5 pb-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Receitas</div>
            <div className="text-2xl font-bold font-heading tabular text-emerald-400">{formatCurrency(totalIncome)}</div>
          </CardContent>
        </Card>
        <Card className="border-t-2 border-rose-400">
          <CardContent className="pt-5 pb-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Despesas</div>
            <div className="text-2xl font-bold font-heading tabular text-rose-400">{formatCurrency(totalExpense)}</div>
          </CardContent>
        </Card>
        <Card className={`border-t-2 ${balance >= 0 ? 'border-emerald-400' : 'border-rose-400'}`}>
          <CardContent className="pt-5 pb-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Saldo</div>
            <div className={`text-2xl font-bold font-heading tabular ${balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(balance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Lançamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground w-12">#</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Data</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Descrição</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Categoria</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">Valor</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    Nenhum lançamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                shown.map((t) => (
                  <TableRow key={t.id} className="border-border hover:bg-muted/40 transition-colors">
                    <TableCell className="text-muted-foreground text-xs tabular">{t.id}</TableCell>
                    <TableCell className="text-sm tabular">{formatBrazilian(t.transaction_date)}</TableCell>
                    <TableCell className="text-sm">{t.description ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(t.categories as unknown as { name: string } | null)?.name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${t.type === 'income' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        {t.type === 'income' ? 'Receita' : 'Despesa'}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right tabular font-semibold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase tracking-wider px-1.5 ${t.paid ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-muted-foreground'}`}
                      >
                        {t.paid ? 'Pago' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <TransactionRowActions id={t.id} paid={t.paid} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {(transactions.length > LIST_LIMIT || capped) && (
            <p className="text-xs text-muted-foreground mt-4">
              {capped
                ? `Totais calculados sobre os ${QUERY_CAP} lançamentos mais recentes do filtro; `
                : 'Totais incluem todos os lançamentos do filtro; '}
              a tabela mostra os {LIST_LIMIT} mais recentes
              {transactions.length > LIST_LIMIT && !capped ? ` (de ${transactions.length})` : ''}. Use o filtro de mês para ver os demais.
            </p>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
