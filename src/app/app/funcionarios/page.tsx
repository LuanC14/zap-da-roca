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
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Equipe</p>
          <h1 className="text-3xl font-bold font-heading text-foreground">Funcionários</h1>
        </div>
        <p className="text-xs text-muted-foreground pb-1">
          Registre ponto via <code className="bg-muted px-1.5 py-0.5 rounded text-primary">!ponto</code> no WhatsApp
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Equipe Cadastrada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Nome</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">Diária</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">H. Extra</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Dias</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Horário</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!employees?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    Nenhum funcionário cadastrado. Insira diretamente no Supabase ou via API.
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((e) => (
                  <TableRow key={e.id} className="border-border hover:bg-muted/40 transition-colors">
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-right tabular text-amber-400 font-semibold">{formatCurrency(e.daily_rate)}</TableCell>
                    <TableCell className="text-right tabular text-muted-foreground">{formatCurrency(e.overtime_rate)}/h</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(e.work_days as string[]).join(', ')}
                    </TableCell>
                    <TableCell className="text-sm tabular text-muted-foreground">
                      {(e.work_hours as { start: string; end: string }).start}–{(e.work_hours as { start: string; end: string }).end}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase tracking-wider px-1.5 ${e.active ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-muted-foreground'}`}
                      >
                        {e.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular">
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
