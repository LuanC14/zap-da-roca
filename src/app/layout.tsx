import type { Metadata } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import './globals.css'

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
  title: 'Zap da Roça — Gestão Financeira no Campo',
  description: 'Gerencie sua fazenda pelo WhatsApp. Controle financeiro e mão de obra para produtores rurais.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Zap da Roça',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`dark ${syne.variable} ${dmSans.variable}`}>
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
