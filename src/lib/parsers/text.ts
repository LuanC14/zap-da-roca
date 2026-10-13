// Lowercase, accent-free, trimmed — for comparisons only (never for text shown or stored)
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

// Same as normalizeText but also drops spaces/punctuation: "Combustível / Diesel" → "combustiveldiesel"
export function matchKey(s: string): string {
  return normalizeText(s).replace(/[^a-z0-9]/g, '')
}

// Brazilian money: "350", "350,50", "1.500,00", "1.500", "R$ 2.000,5" → number | null
export function parseAmount(input: string): number | null {
  let s = input.trim().replace(/^r\$\s*/i, '')
  if (!/^\d[\d.,]*$/.test(s)) return null

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? ',' : '.'
    const thousands = decimal === ',' ? '.' : ','
    s = s.split(thousands).join('').replace(decimal, '.')
  } else if (lastComma !== -1) {
    s = s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (lastDot !== -1) {
    const groups = s.split('.')
    const looksLikeThousands =
      groups.length > 2 || (groups[0] !== '0' && /^\d{1,3}$/.test(groups[0]) && groups[1].length === 3)
    if (looksLikeThousands) s = groups.join('')
  }

  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0 || n > 9_999_999_999.99) return null
  return Math.round(n * 100) / 100
}

// Worked hours: "2", "2,5", "0.5" → 0 < h <= 24
export function parseHours(input: string): number | null {
  if (!/^\d{1,2}([.,]\d{1,2})?$/.test(input.trim())) return null
  const n = Number(input.trim().replace(',', '.'))
  return n > 0 && n <= 24 ? n : null
}

// Daily / overtime rate typed in a form (pt-BR). Fits numeric(10,2). Overtime may be zero.
export function parseRate(input: string, allowZero = false): number | null {
  if (allowZero && /^0+([.,]0+)?$/.test(input.trim())) return 0
  const n = parseAmount(input)
  return n !== null && n <= 99_999_999.99 ? n : null
}
