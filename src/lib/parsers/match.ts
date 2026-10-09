import { matchKey } from './text'

export interface CategoryRow {
  id: string
  name: string
  type: 'expense' | 'income' | 'both'
  user_id: string | null
}

export interface EmployeeRow {
  id: string
  name: string
}

// Accent/space/punctuation-insensitive: "combustivel" → "Combustível / Diesel", "maodeobra" → "Mão de Obra".
// Prefers categories compatible with the transaction type, then the user's own, then closest name.
export function matchCategory(
  categories: CategoryRow[],
  keyword: string,
  txType: 'expense' | 'income'
): CategoryRow | null {
  const kw = matchKey(keyword)
  if (!kw) return null

  const candidates = categories.filter((c) => matchKey(c.name).includes(kw))
  if (!candidates.length) return null

  const score = (c: CategoryRow) => {
    const key = matchKey(c.name)
    return (
      (c.type === txType || c.type === 'both' ? 100 : 0) +
      (c.user_id ? 10 : 0) +
      (key.startsWith(kw) ? 5 : 0) -
      key.length / 1000
    )
  }

  return [...candidates].sort((a, b) => score(b) - score(a))[0]
}

// An exact name always wins; otherwise a single partial match is accepted and several are reported
export function matchEmployee<T extends EmployeeRow>(
  employees: T[],
  query: string
): { status: 'found'; employee: T } | { status: 'none' } | { status: 'ambiguous'; names: string[] } {
  const q = matchKey(query)
  if (!q) return { status: 'none' }

  const exact = employees.filter((e) => matchKey(e.name) === q)
  if (exact.length === 1) return { status: 'found', employee: exact[0] }

  const partial = employees.filter((e) => matchKey(e.name).includes(q))
  if (partial.length === 1) return { status: 'found', employee: partial[0] }
  if (partial.length === 0) return { status: 'none' }

  return { status: 'ambiguous', names: partial.map((e) => e.name) }
}
