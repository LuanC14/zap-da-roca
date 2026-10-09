import { parseBrazilianDate, todayISO } from './date-parser'
import { normalizeText, parseAmount, parseHours } from './text'

export type CommandName =
  | 'pagar'
  | 'receber'
  | 'pago'
  | 'saldo'
  | 'relatorio'
  | 'ponto'
  | 'extra'
  | 'mao_obra'
  | 'funcionarios'
  | 'ajuda'
  | 'unknown'

export interface ParsedCommand {
  command: CommandName
  raw: string
  // Financial
  amount?: number
  categoryKeyword?: string
  description?: string
  date?: string
  // Payment
  transactionId?: number
  // Work record
  employeeName?: string
  hours?: number
  // Report period
  period?: string
}

export function parseCommand(text: string, now: Date = new Date()): ParsedCommand {
  const raw = text.trim()

  if (!raw.startsWith('!')) {
    return { command: 'unknown', raw }
  }

  // `rawParts` keeps the user's casing/accents (for stored text); `parts` is for matching
  const rawParts = raw.slice(1).split(/\s+/).filter(Boolean)
  const parts = rawParts.map(normalizeText)
  const cmd = parts[0]
  const today = todayISO(now)

  switch (cmd) {
    case 'ajuda':
    case 'help':
      return { command: 'ajuda', raw }

    case 'funcionarios':
      return { command: 'funcionarios', raw }

    case 'saldo':
      return { command: 'saldo', raw }

    case 'pago': {
      const token = parts[1]?.replace(/^#/, '')
      const id = token && /^\d+$/.test(token) ? parseInt(token, 10) : undefined
      return { command: 'pago', raw, transactionId: id }
    }

    case 'relatorio':
      return { command: 'relatorio', raw, period: parts[1] }

    case 'mao_obra':
    case 'mao-obra':
    case 'maodeobra':
      return { command: 'mao_obra', raw, period: parts[1] }

    case 'ponto': {
      const nameParts: string[] = []
      let date: string | undefined
      for (let i = 1; i < parts.length; i++) {
        const parsed = parseBrazilianDate(parts[i], now)
        if (parsed) { date = parsed; break }
        nameParts.push(rawParts[i])
      }
      return {
        command: 'ponto',
        raw,
        employeeName: nameParts.join(' ') || undefined,
        date: date ?? today,
      }
    }

    case 'extra': {
      const nameParts: string[] = []
      let hours: number | undefined
      let date: string | undefined
      for (let i = 1; i < parts.length; i++) {
        const parsedDate = parseBrazilianDate(parts[i], now)
        if (parsedDate) { date = parsedDate; continue }
        if (hours === undefined && nameParts.length > 0) {
          const h = parseHours(parts[i])
          if (h !== null) { hours = h; continue }
        }
        if (hours === undefined) nameParts.push(rawParts[i])
      }
      return {
        command: 'extra',
        raw,
        employeeName: nameParts.join(' ') || undefined,
        hours,
        date: date ?? today,
      }
    }

    case 'pagar':
    case 'receber': {
      const command: CommandName = cmd

      const amount = parts[1] !== undefined ? parseAmount(parts[1]) : null
      if (amount === null) return { command, raw }

      const categoryKeyword = parts[2]

      const rest = rawParts.slice(3)
      let date: string | undefined
      if (rest.length > 0) {
        const lastParsed = parseBrazilianDate(rest[rest.length - 1], now)
        if (lastParsed) {
          date = lastParsed
          rest.pop()
        }
      }

      return {
        command,
        raw,
        amount,
        categoryKeyword,
        description: rest.join(' ') || undefined,
        date: date ?? today,
      }
    }

    default:
      return { command: 'unknown', raw }
  }
}
