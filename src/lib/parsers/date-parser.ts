import { parse, isValid, format } from 'date-fns'

// Parses DD/MM/AAAA or DD/MM/AA → ISO date string YYYY-MM-DD
export function parseBrazilianDate(input: string): string | null {
  const clean = input.trim()

  const formats = ['dd/MM/yyyy', 'dd/MM/yy', 'd/M/yyyy', 'd/M/yy']
  for (const fmt of formats) {
    const parsed = parse(clean, fmt, new Date())
    if (isValid(parsed)) {
      return format(parsed, 'yyyy-MM-dd')
    }
  }
  return null
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatBrazilian(isoDate: string): string {
  const parsed = parse(isoDate, 'yyyy-MM-dd', new Date())
  return isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : isoDate
}

export function currentMonthRange(): { start: string; end: string } {
  const now = new Date()
  const start = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
  const end = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd')
  return { start, end }
}

// Parses "MM/AAAA" or "mes/AAAA" (e.g. "set/2026", "09/2026") → { start, end }
export function parseMonthPeriod(input: string): { start: string; end: string } | null {
  const monthNames: Record<string, number> = {
    jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
    jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
  }

  // Try MM/YYYY
  const numMatch = input.match(/^(\d{1,2})\/(\d{4})$/)
  if (numMatch) {
    const month = parseInt(numMatch[1]) - 1
    const year = parseInt(numMatch[2])
    if (month >= 0 && month <= 11) {
      const start = format(new Date(year, month, 1), 'yyyy-MM-dd')
      const end = format(new Date(year, month + 1, 0), 'yyyy-MM-dd')
      return { start, end }
    }
  }

  // Try mes/YYYY
  const nameMatch = input.match(/^([a-z]{3})\/(\d{4})$/i)
  if (nameMatch) {
    const monthIndex = monthNames[nameMatch[1].toLowerCase()]
    const year = parseInt(nameMatch[2])
    if (monthIndex !== undefined) {
      const start = format(new Date(year, monthIndex, 1), 'yyyy-MM-dd')
      const end = format(new Date(year, monthIndex + 1, 0), 'yyyy-MM-dd')
      return { start, end }
    }
  }

  return null
}
