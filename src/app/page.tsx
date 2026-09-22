import Link from 'next/link'
import { MessageCircleMore, BarChart3, Users, Wallet, ChevronRight, Check } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Navbar */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-primary/15 flex items-center justify-center">
              <span className="text-primary text-xs font-bold font-heading">ZR</span>
            </div>
            <span className="font-heading font-bold text-base text-foreground">Zap da Roça</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/entrar" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-md font-medium hover:bg-primary/90 transition-colors"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-6">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
          7 dias grátis — sem cartão de crédito
        </div>
        <h1 className="font-heading text-4xl sm:text-5xl font-bold text-foreground text-wrap-balance leading-tight mb-4">
          Gestão da fazenda<br />
          <span className="text-primary">pelo WhatsApp</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8 leading-relaxed">
          Registre despesas, receitas e ponto de funcionários mandando uma mensagem.
          Visualize tudo em um painel moderno, de qualquer lugar.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/cadastro"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90 transition-colors"
          >
            Criar conta gratuita <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/entrar"
            className="flex items-center gap-2 bg-card border border-border text-foreground px-6 py-3 rounded-md font-medium hover:bg-muted/30 transition-colors"
          >
            Já tenho conta
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: MessageCircleMore,
              color: 'text-cyan-400',
              bg: 'bg-cyan-400/10',
              title: 'Tudo pelo WhatsApp',
              desc: 'Registre despesas, receitas e ponto com comandos simples. Sem abrir app, sem digitar em tabela.',
              example: '!pagar 350 combustivel abastecimento trator',
            },
            {
              icon: BarChart3,
              color: 'text-violet-400',
              bg: 'bg-violet-400/10',
              title: 'Painel em tempo real',
              desc: 'KPIs do mês, fluxo de caixa, custo de mão de obra e contas a pagar — tudo em um lugar.',
              example: null,
            },
            {
              icon: Users,
              color: 'text-emerald-400',
              bg: 'bg-emerald-400/10',
              title: 'Controle de mão de obra',
              desc: 'Registre diárias e horas extras. Veja o custo real de cada funcionário no mês.',
              example: '!ponto João  →  !extra Maria 2h',
            },
            {
              icon: Wallet,
              color: 'text-amber-400',
              bg: 'bg-amber-400/10',
              title: 'Categorias agrícolas',
              desc: 'Insumos, combustível, maquinário, venda de safra — categorias prontas para o campo.',
              example: null,
            },
            {
              icon: MessageCircleMore,
              color: 'text-rose-400',
              bg: 'bg-rose-400/10',
              title: 'Lembrete diário',
              desc: 'Às 8h recebe um resumo das contas do dia no WhatsApp. Nunca mais esquece de pagar.',
              example: null,
            },
            {
              icon: BarChart3,
              color: 'text-cyan-400',
              bg: 'bg-cyan-400/10',
              title: 'Relatórios por período',
              desc: 'Gere relatórios mensais ou anuais por categoria, funcionário ou tipo de lançamento.',
              example: '!relatorio 09/2026',
            },
          ].map((f) => {
            const Icon = f.icon
            return (
              <div key={f.title} className="bg-card border border-border rounded-lg p-5">
                <div className={`inline-flex items-center justify-center w-9 h-9 rounded ${f.bg} mb-3`}>
                  <Icon className={`h-4.5 w-4.5 ${f.color}`} />
                </div>
                <h3 className="font-heading font-bold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                {f.example && (
                  <code className="mt-3 block text-xs bg-background border border-border rounded px-2.5 py-1.5 text-cyan-400 font-mono">
                    {f.example}
                  </code>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">Preço</p>
          <h2 className="font-heading text-3xl font-bold text-foreground">Simples e direto</h2>
        </div>
        <div className="max-w-sm mx-auto bg-card border-2 border-primary/30 rounded-xl p-8 text-center relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Mais popular
            </span>
          </div>
          <div className="mb-6">
            <div className="font-heading text-4xl font-bold text-foreground">
              R$ 29<span className="text-xl text-muted-foreground">,90</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">por mês, cancele quando quiser</div>
          </div>
          <ul className="space-y-3 text-sm text-left mb-8">
            {[
              'Bot WhatsApp ilimitado',
              'Painel web completo',
              'Funcionários ilimitados',
              'Relatórios por período',
              'Lembrete diário às 8h',
              'Suporte via WhatsApp',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/cadastro"
            className="block w-full bg-primary text-primary-foreground font-medium rounded-md py-3 text-sm hover:bg-primary/90 transition-colors"
          >
            Começar 7 dias grátis
          </Link>
          <p className="text-xs text-muted-foreground mt-3">Sem cartão para começar</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© 2026 Zap da Roça</span>
          <span>Feito para o produtor rural brasileiro</span>
        </div>
      </footer>

    </div>
  )
}
