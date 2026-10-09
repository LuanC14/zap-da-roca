const TZ = 'America/Sao_Paulo'

const pad = (n: number) => String(n).padStart(2, '0')

function isRealDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
}

function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

// Today in Brazil (the server runs in UTC, so a plain `new Date()` is wrong after 21:00 BRT)
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

// Parses DD/MM/AAAA, DD/MM/AA or DD/MM (current year) → YYYY-MM-DD
export function parseBrazilianDate(input: string, now: Date = new Date()): string | null {
  const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/)
  if (!m) return null

  const day = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  let year: number
  if (m[3] === undefined) year = parseInt(todayISO(now).slice(0, 4), 10)
  else year = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10)

  if (!isRealDate(year, month, day)) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

export function formatBrazilian(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : isoDate
}

export function monthRange(year: number, month: number): { start: string; end: string } {
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDayOf(year, month))}`,
  }
}

export function currentMonthRange(now: Date = new Date()): { start: string; end: string } {
  const [year, month] = todayISO(now).split('-').map(Number)
  return monthRange(year, month)
}

export function isISODate(value: string | undefined | null): value is string {
  if (!value) return false
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return !!m && isRealDate(+m[1], +m[2], +m[3])
}

// Parses "YYYY-MM" (query-string filter) → { start, end }
export function parseYearMonth(value: string | undefined | null): { start: string; end: string } | null {
  const m = value?.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const year = +m[1]
  const month = +m[2]
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null
  return monthRange(year, month)
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
}

// Parses "MM/AAAA" or "mes/AAAA" (e.g. "set/2026", "09/2026") → { start, end }
export function parseMonthPeriod(input: string): { start: string; end: string } | null {
  const numMatch = input.match(/^(\d{1,2})\/(\d{4})$/)
  if (numMatch) {
    const month = parseInt(numMatch[1], 10)
    const year = parseInt(numMatch[2], 10)
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) return monthRange(year, month)
    return null
  }

  const nameMatch = input.match(/^([a-z]{3})\/(\d{4})$/i)
  if (nameMatch) {
    const month = MONTH_NAMES[nameMatch[1].toLowerCase()]
    const year = parseInt(nameMatch[2], 10)
    if (month !== undefined && year >= 2000 && year <= 2100) return monthRange(year, month)
  }

  return null
}
