import type { Metadata } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/sidebar'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ZapRural — Gestão Financeira no Campo',
  description: 'Sistema de gestão financeira e mão de obra para produtores rurais',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`dark ${syne.variable} ${dmSans.variable}`}>
      <body>
        <div className="flex min-h-screen bg-background">
          <Sidebar />
          <main className="flex-1 p-8 overflow-auto min-w-0 bg-dot-grid">{children}</main>
        </div>
      </body>
    </html>
  )
}
