import { supabaseAdmin } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function ConfiguracoesPage() {
  const { data: categories } = await supabaseAdmin
    .from('categories')
    .select('*')
    .order('type')
    .order('name')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categorias</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Padrão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(categories ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={c.type === 'income' ? 'default' : c.type === 'expense' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {c.type === 'income' ? 'Receita' : c.type === 'expense' ? 'Despesa' : 'Ambos'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.is_default && <Badge variant="outline" className="text-xs">Padrão</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-4">
            Para adicionar categorias, insira diretamente na tabela <code className="bg-muted px-1 rounded">categories</code> no Supabase.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integração WhatsApp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">API</span>
            <span>WhatsApp Business Cloud API (Meta)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Lembrete diário</span>
            <span>08:00 (horário de Brasília)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Webhook</span>
            <code className="bg-muted px-1 rounded text-xs">/api/whatsapp/webhook</code>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Configure as variáveis de ambiente conforme o arquivo <code className="bg-muted px-1 rounded">.env.local.example</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
