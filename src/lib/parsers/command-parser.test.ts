import { describe, expect, it } from 'vitest'
import { parseCommand } from './command-parser'
import { parseAmount, parseHours } from './text'

const NOW = new Date('2026-10-08T15:00:00Z')
const parse = (t: string) => parseCommand(t, NOW)

describe('parseAmount (pt-BR money)', () => {
  it.each([
    ['350', 350],
    ['350,50', 350.5],
    ['350.50', 350.5],
    ['1.500,00', 1500],
    ['1.500', 1500],
    ['1.500.000', 1500000],
    ['1,500.00', 1500],
    ['0.5', 0.5],
    ['R$ 2.000,5', 2000.5],
  ])('%s → %d', (input, expected) => {
    expect(parseAmount(input)).toBe(expected)
  })

  it.each(['', 'abc', '-500', '0', '0,00', '350abc', '1e5', '99999999999'])('rejects %j', (input) => {
    expect(parseAmount(input)).toBeNull()
  })
})

describe('parseHours', () => {
  it('accepts comma or dot decimals within 0 < h <= 24', () => {
    expect(parseHours('2')).toBe(2)
    expect(parseHours('2,5')).toBe(2.5)
    expect(parseHours('0.5')).toBe(0.5)
    expect(parseHours('24')).toBe(24)
  })
  it('rejects zero, negatives, > 24 and noise', () => {
    for (const bad of ['0', '-1', '25', '99', 'x', '2h']) expect(parseHours(bad)).toBeNull()
  })
})

describe('parseCommand', () => {
  it('ignores messages without the ! prefix', () => {
    expect(parse('oi tudo bem').command).toBe('unknown')
    expect(parse('').command).toBe('unknown')
  })

  it('is case- and accent-insensitive for command names', () => {
    expect(parse('!AJUDA').command).toBe('ajuda')
    expect(parse('!Funcionários').command).toBe('funcionarios')
    expect(parse('!MÃO_OBRA set/2026')).toMatchObject({ command: 'mao_obra', period: 'set/2026' })
  })

  describe('!pagar / !receber', () => {
    it('parses the documented example and keeps the description as typed', () => {
      expect(parse('!pagar 350 combustivel Abastecimento do Trator 15/09/2026')).toMatchObject({
        command: 'pagar',
        amount: 350,
        categoryKeyword: 'combustivel',
        description: 'Abastecimento do Trator',
        date: '2026-09-15',
      })
    })

    it('defaults the date to today in Brazil', () => {
      expect(parse('!receber 8000 safra venda milho').date).toBe('2026-10-08')
      expect(parseCommand('!pagar 10 diesel x', new Date('2026-10-09T01:00:00Z')).date).toBe('2026-10-08')
    })

    it('reads Brazilian thousands/decimal formats instead of silently shrinking the value', () => {
      expect(parse('!pagar 1.500,00 insumos adubo').amount).toBe(1500)
      expect(parse('!receber 12.345,67 safra soja').amount).toBe(12345.67)
    })

    it('accepts a date as the only token after the category', () => {
      expect(parse('!pagar 80 diesel 15/09')).toMatchObject({ description: undefined, date: '2026-09-15' })
    })

    it('rejects zero, negative and non-numeric amounts', () => {
      for (const t of ['!pagar 0 diesel', '!pagar -500 diesel', '!pagar abc diesel', '!pagar']) {
        expect(parse(t).amount).toBeUndefined()
      }
    })
  })

  describe('!pago', () => {
    it('parses plain and #-prefixed ids', () => {
      expect(parse('!pago 42').transactionId).toBe(42)
      expect(parse('!pago #42').transactionId).toBe(42)
    })
    it('does not accept partially numeric ids', () => {
      expect(parse('!pago 42abc').transactionId).toBeUndefined()
      expect(parse('!pago').transactionId).toBeUndefined()
    })
  })

  describe('!ponto', () => {
    it('keeps accents and multi-word names for display', () => {
      expect(parse('!ponto João da Silva 15/09/2026')).toMatchObject({
        command: 'ponto',
        employeeName: 'João da Silva',
        date: '2026-09-15',
      })
    })
    it('defaults to today and reports a missing name', () => {
      expect(parse('!ponto')).toMatchObject({ employeeName: undefined, date: '2026-10-08' })
    })
  })

  describe('!extra', () => {
    it('parses name, hours and date', () => {
      expect(parse('!extra João 2 15/09/2026')).toMatchObject({
        employeeName: 'João',
        hours: 2,
        date: '2026-09-15',
      })
    })
    it('accepts decimal hours with a comma (was truncated to 2)', () => {
      expect(parse('!extra Maria Souza 2,5').hours).toBe(2.5)
    })
    it('accepts the date before the hours', () => {
      expect(parse('!extra João 15/09 3')).toMatchObject({ hours: 3, date: '2026-09-15' })
    })
    it('drops invalid hours', () => {
      expect(parse('!extra João 30').hours).toBeUndefined()
      expect(parse('!extra João -2').hours).toBeUndefined()
    })
  })

  it('parses report periods', () => {
    expect(parse('!relatorio 09/2026').period).toBe('09/2026')
    expect(parse('!saldo').command).toBe('saldo')
  })

  it('returns unknown for unrecognised commands', () => {
    expect(parse('!dançar').command).toBe('unknown')
  })
})
