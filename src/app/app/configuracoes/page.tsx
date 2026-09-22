import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LogoutButton } from '@/components/logout-button'

export default async function ConfiguracoesPage() {
  const { data: categories } = await supabaseAdmin
    .from('categories')
    .select('*')
    .order('type')
    .order('name')

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Header */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Sistema</p>
        <h1 className="text-3xl font-bold font-heading text-foreground">Configurações</h1>
      </div>

      {/* Categorias */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Categorias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Nome</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Padrão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(categories ?? []).map((c) => (
                <TableRow key={c.id} className="border-border hover:bg-muted/40 transition-colors">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase tracking-wider px-1.5 ${
                        c.type === 'income'
                          ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
                          : c.type === 'expense'
                          ? 'text-rose-400 border-rose-400/30 bg-rose-400/10'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {c.type === 'income' ? 'Receita' : c.type === 'expense' ? 'Despesa' : 'Ambos'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.is_default && (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider px-1.5 text-primary border-primary/30 bg-primary/10">
                        Padrão
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-4">
            Para adicionar categorias, insira diretamente na tabela{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded text-primary text-[11px]">categories</code> no Supabase.
          </p>
        </CardContent>
      </Card>

      {/* Integração WhatsApp */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Integração WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'API',              value: 'WhatsApp Business Cloud API (Meta)' },
            { label: 'Lembrete diário',  value: '08:00 — horário de Brasília' },
            { label: 'Webhook',          value: '/api/whatsapp/webhook', mono: true },
          ].map((row) => (
            <div key={row.label} className="flex justify-between items-center text-sm py-1 border-b border-border last:border-0">
              <span className="text-muted-foreground">{row.label}</span>
              {row.mono ? (
                <code className="bg-muted px-2 py-0.5 rounded text-primary text-xs">{row.value}</code>
              ) : (
                <span className="text-foreground">{row.value}</span>
              )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-1">
            Configure as variáveis de ambiente conforme{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded text-primary text-[11px]">.env.local.example</code>.
          </p>
        </CardContent>
      </Card>

      {/* Conta */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Conta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground font-medium">Encerrar sessão</p>
              <p className="text-xs text-muted-foreground mt-0.5">Você será redirecionado para a página inicial.</p>
            </div>
            <LogoutButton />
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
