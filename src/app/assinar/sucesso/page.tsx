import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export default function AssinaturaSuccessPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded bg-primary/15 flex items-center justify-center">
            <span className="text-primary text-xs font-bold font-heading">ZR</span>
          </div>
          <span className="font-heading font-bold text-lg text-foreground">Zap da Roça</span>
        </div>

        <div className="flex justify-center mb-5">
          <CheckCircle className="h-14 w-14 text-emerald-400" />
        </div>

        <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
          Assinatura recebida!
        </h1>
        <p className="text-sm text-muted-foreground mb-1">
          Seu pagamento está sendo processado pelo Mercado Pago.
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Você receberá uma confirmação em breve. O acesso será liberado automaticamente após a aprovação.
        </p>

        <Link href="/app" className={buttonVariants({ size: 'sm' })}>
          Ir para o portal
        </Link>
      </div>
    </div>
  )
}
