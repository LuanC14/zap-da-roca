import { parseBrazilianDate, todayISO } from './date-parser'

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

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

export function parseCommand(text: string): ParsedCommand {
  const raw = text.trim()
  const normalized = normalizeText(raw)

  if (!normalized.startsWith('!')) {
    return { command: 'unknown', raw }
  }

  const parts = normalized.replace(/^!/, '').split(/\s+/)
  const cmd = parts[0]

  // !ajuda
  if (cmd === 'ajuda' || cmd === 'help') {
    return { command: 'ajuda', raw }
  }

  // !funcionarios
  if (cmd === 'funcionarios') {
    return { command: 'funcionarios', raw }
  }

  // !saldo
  if (cmd === 'saldo') {
    return { command: 'saldo', raw }
  }

  // !pago <id>
  if (cmd === 'pago') {
    const id = parseInt(parts[1])
    return { command: 'pago', raw, transactionId: isNaN(id) ? undefined : id }
  }

  // !relatorio [mes/ano]
  if (cmd === 'relatorio') {
    return { command: 'relatorio', raw, period: parts[1] }
  }

  // !mao_obra [periodo]
  if (cmd === 'mao_obra' || cmd === 'mao-obra' || cmd === 'maodeobra') {
    return { command: 'mao_obra', raw, period: parts[1] }
  }

  // !ponto <nome> [data]
  if (cmd === 'ponto') {
    const nameParts: string[] = []
    let date: string | undefined
    for (let i = 1; i < parts.length; i++) {
      const parsed = parseBrazilianDate(parts[i])
      if (parsed) { date = parsed; break }
      nameParts.push(parts[i])
    }
    return {
      command: 'ponto',
      raw,
      employeeName: nameParts.join(' ') || undefined,
      date: date ?? todayISO(),
    }
  }

  // !extra <nome> <horas> [data]
  if (cmd === 'extra') {
    const nameParts: string[] = []
    let hours: number | undefined
    let date: string | undefined
    for (let i = 1; i < parts.length; i++) {
      const parsed = parseBrazilianDate(parts[i])
      if (parsed) { date = parsed; continue }
      const asNum = parseFloat(parts[i])
      if (!isNaN(asNum) && hours === undefined && nameParts.length > 0) {
        hours = asNum
        continue
      }
      if (hours === undefined) nameParts.push(parts[i])
    }
    return {
      command: 'extra',
      raw,
      employeeName: nameParts.join(' ') || undefined,
      hours,
      date: date ?? todayISO(),
    }
  }

  // !pagar / !receber  <valor> <categoria> <descricao...> [data]
  if (cmd === 'pagar' || cmd === 'receber') {
    const command: CommandName = cmd === 'pagar' ? 'pagar' : 'receber'

    // First token after command = valor
    const amount = parseFloat(parts[1]?.replace(',', '.') ?? '')
    if (isNaN(amount)) return { command, raw }

    // Second token = categoria
    const categoryKeyword = parts[2]

    // Remaining tokens = description + optional date at end
    const rest = parts.slice(3)
    let date: string | undefined
    if (rest.length > 0) {
      const lastParsed = parseBrazilianDate(rest[rest.length - 1])
      if (lastParsed) {
        date = lastParsed
        rest.pop()
      }
    }
    const description = rest.join(' ') || undefined

    return {
      command,
      raw,
      amount,
      categoryKeyword,
      description,
      date: date ?? todayISO(),
    }
  }

  return { command: 'unknown', raw }
}
