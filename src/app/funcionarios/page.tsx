import { supabaseAdmin } from '@/lib/supabase'
import { formatBrazilian } from '@/lib/parsers/date-parser'
import { formatCurrency } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function FuncionariosPage() {
  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('*')
    .order('name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Funcionários</h1>
        <p className="text-xs text-muted-foreground">
          Cadastre funcionários via painel ou use <code className="bg-muted px-1 rounded">!ponto</code> pelo WhatsApp
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipe Cadastrada</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Diária</TableHead>
                <TableHead className="text-right">H. Extra</TableHead>
                <TableHead>Dias de Trabalho</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastrado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!employees?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum funcionário cadastrado. Insira diretamente no banco de dados pelo Supabase ou via API.
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(e.daily_rate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(e.overtime_rate)}/h</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(e.work_days as string[]).join(', ')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(e.work_hours as { start: string; end: string }).start} –{' '}
                      {(e.work_hours as { start: string; end: string }).end}
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.active ? 'default' : 'secondary'} className="text-xs">
                        {e.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatBrazilian(e.created_at.split('T')[0])}
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
