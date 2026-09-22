'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  BarChart3,
  Settings2,
  MessageCircleMore,
} from 'lucide-react'

const navItems = [
  { href: '/',              label: 'Painel',        icon: LayoutDashboard },
  { href: '/financeiro',    label: 'Financeiro',    icon: TrendingUp },
  { href: '/funcionarios',  label: 'Funcionários',  icon: Users },
  { href: '/relatorios',    label: 'Relatórios',    icon: BarChart3 },
  { href: '/configuracoes', label: 'Configurações', icon: Settings2 },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-primary/15 flex items-center justify-center">
            <span className="text-primary text-xs font-bold font-heading tracking-tight">ZR</span>
          </div>
          <div>
            <div className="text-sm font-bold font-heading text-sidebar-foreground tracking-wide">ZapRural</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mt-0.5">
              Gestão no Campo
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all duration-150',
                active
                  ? 'bg-primary/10 text-primary border-l-2 border-primary pl-[10px] font-medium'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground border-l-2 border-transparent pl-[10px]'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bot status */}
      <div className="px-5 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <MessageCircleMore className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Bot WhatsApp</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
            <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">Ativo</span>
          </div>
        </div>
      </div>

    </aside>
  )
}
