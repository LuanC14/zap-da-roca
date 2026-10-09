import { describe, expect, it } from 'vitest'
import { matchCategory, matchEmployee, type CategoryRow } from './match'

const globals: CategoryRow[] = [
  { id: 'c1', name: 'Insumos / Adubos', type: 'expense', user_id: null },
  { id: 'c2', name: 'Combustível / Diesel', type: 'expense', user_id: null },
  { id: 'c3', name: 'Maquinário', type: 'expense', user_id: null },
  { id: 'c4', name: 'Mão de Obra', type: 'expense', user_id: null },
  { id: 'c5', name: 'Venda de Safra', type: 'income', user_id: null },
]

describe('matchCategory', () => {
  // These are the keywords the !ajuda message tells users to type. Three of the five used to
  // miss because the stored names are accented ("Combustível", "Maquinário", "Mão de Obra").
  it.each([
    ['combustivel', 'c2'],
    ['diesel', 'c2'],
    ['insumos', 'c1'],
    ['adubos', 'c1'],
    ['maquinario', 'c3'],
    ['maodeobra', 'c4'],
    ['mao', 'c4'],
  ])('expense keyword %s → %s', (kw, id) => {
    expect(matchCategory(globals, kw, 'expense')?.id).toBe(id)
  })

  it('matches income categories for receitas', () => {
    expect(matchCategory(globals, 'safra', 'income')?.id).toBe('c5')
  })

  it('returns null when nothing matches', () => {
    expect(matchCategory(globals, 'veterinario', 'expense')).toBeNull()
    expect(matchCategory(globals, '', 'expense')).toBeNull()
  })

  it('prefers a category that fits the transaction type', () => {
    const cats: CategoryRow[] = [
      { id: 'a', name: 'Safra (adiantamento)', type: 'expense', user_id: null },
      { id: 'b', name: 'Venda de Safra', type: 'income', user_id: null },
    ]
    expect(matchCategory(cats, 'safra', 'income')?.id).toBe('b')
    expect(matchCategory(cats, 'safra', 'expense')?.id).toBe('a')
  })

  it("prefers the tenant's own category over a global one", () => {
    const cats: CategoryRow[] = [
      { id: 'g', name: 'Combustível', type: 'expense', user_id: null },
      { id: 'own', name: 'Combustível', type: 'expense', user_id: 'user-a' },
    ]
    expect(matchCategory(cats, 'combustivel', 'expense')?.id).toBe('own')
  })
})

describe('matchEmployee', () => {
  const team = [
    { id: '1', name: 'João Silva' },
    { id: '2', name: 'José Santos' },
    { id: '3', name: 'Maria Souza' },
    { id: '4', name: 'Maria Silva' },
  ]

  it('finds an accented name from an unaccented query', () => {
    expect(matchEmployee(team, 'joao')).toEqual({ status: 'found', employee: team[0] })
    expect(matchEmployee(team, 'JOSÉ')).toEqual({ status: 'found', employee: team[1] })
  })

  it('reports ambiguity instead of picking someone arbitrarily', () => {
    expect(matchEmployee(team, 'maria')).toEqual({ status: 'ambiguous', names: ['Maria Souza', 'Maria Silva'] })
  })

  it('lets a full name disambiguate', () => {
    expect(matchEmployee(team, 'maria silva')).toEqual({ status: 'found', employee: team[3] })
  })

  it('returns none for unknown names', () => {
    expect(matchEmployee(team, 'pedro')).toEqual({ status: 'none' })
    expect(matchEmployee(team, '')).toEqual({ status: 'none' })
  })
})
