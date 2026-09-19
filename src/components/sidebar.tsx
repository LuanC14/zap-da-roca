'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Início', icon: '🏠' },
  { href: '/financeiro', label: 'Financeiro', icon: '💰' },
  { href: '/funcionarios', label: 'Funcionários', icon: '👷' },
  { href: '/relatorios', label: 'Relatórios', icon: '📊' },
  { href: '/configuracoes', label: 'Configurações', icon: '⚙️' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 min-h-screen bg-card border-r flex flex-col">
      <div className="p-4 border-b">
        <div className="font-bold text-lg text-green-700">🌾 ZapRural</div>
        <div className="text-xs text-muted-foreground">Gestão no Campo</div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              pathname === item.href
                ? 'bg-green-100 text-green-800 font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t text-xs text-muted-foreground">
        Bot WhatsApp ativo
      </div>
    </aside>
  )
}
