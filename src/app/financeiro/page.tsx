import { supabaseAdmin } from '@/lib/supabase'
import { formatBrazilian } from '@/lib/parsers/date-parser'
import { formatCurrency } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; month?: string }>
}) {
  const params = await searchParams
  const type = params.type ?? ''
  const month = params.month ?? ''

  let query = supabaseAdmin
    .from('transactions')
    .select('id, type, amount, description, transaction_date, paid, paid_at, categories(name)')
    .order('transaction_date', { ascending: false })
    .limit(100)

  if (type === 'expense' || type === 'income') {
    query = query.eq('type', type)
  }
  if (month) {
    query = query.gte('transaction_date', `${month}-01`).lte('transaction_date', `${month}-31`)
  }

  const { data } = await query
  const transactions = data ?? []

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Financeiro</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground mb-1">💚 Receitas</div>
            <div className="text-xl font-bold text-green-700">{formatCurrency(totalIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground mb-1">🔴 Despesas</div>
            <div className="text-xl font-bold text-red-600">{formatCurrency(totalExpense)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground mb-1">Saldo</div>
            <div className={`text-xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {formatCurrency(totalIncome - totalExpense)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum lançamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground text-xs">{t.id}</TableCell>
                    <TableCell className="text-sm">{formatBrazilian(t.transaction_date)}</TableCell>
                    <TableCell className="text-sm">{t.description ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(t.categories as unknown as { name: string } | null)?.name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.type === 'income' ? 'default' : 'destructive'} className="text-xs">
                        {t.type === 'income' ? 'Receita' : 'Despesa'}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${t.type === 'income' ? 'text-green-700' : 'text-red-600'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.paid ? 'secondary' : 'outline'} className="text-xs">
                        {t.paid ? 'Pago' : 'Pendente'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
