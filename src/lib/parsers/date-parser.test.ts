import { describe, expect, it } from 'vitest'
import {
  currentMonthRange,
  formatBrazilian,
  isISODate,
  isReasonableDate,
  parseBrazilianDate,
  parseMonthPeriod,
  parseYearMonth,
  todayISO,
} from './date-parser'

const NOW = new Date('2026-10-08T15:00:00Z')

describe('todayISO (America/Sao_Paulo)', () => {
  it('uses the Brazilian calendar day, not the UTC one', () => {
    // 01:30 UTC on the 9th is still 22:30 on the 8th in Brasília
    expect(todayISO(new Date('2026-10-09T01:30:00Z'))).toBe('2026-10-08')
    expect(todayISO(new Date('2026-10-09T03:00:00Z'))).toBe('2026-10-09')
  })
})

describe('parseBrazilianDate', () => {
  it('parses DD/MM/AAAA', () => {
    expect(parseBrazilianDate('15/09/2026')).toBe('2026-09-15')
    expect(parseBrazilianDate('5/9/2026')).toBe('2026-09-05')
  })

  it('expands two-digit years to 20xx (never year 0026)', () => {
    expect(parseBrazilianDate('15/09/26')).toBe('2026-09-15')
  })

  it('assumes the current year when omitted', () => {
    expect(parseBrazilianDate('15/09', NOW)).toBe('2026-09-15')
  })

  it('rejects impossible dates and non-dates', () => {
    expect(parseBrazilianDate('31/02/2026')).toBeNull()
    expect(parseBrazilianDate('29/02/2027')).toBeNull()
    expect(parseBrazilianDate('32/01/2026')).toBeNull()
    expect(parseBrazilianDate('350')).toBeNull()
    expect(parseBrazilianDate('abc')).toBeNull()
    expect(parseBrazilianDate('')).toBeNull()
  })

  it('accepts a leap day', () => {
    expect(parseBrazilianDate('29/02/2028')).toBe('2028-02-29')
  })
})

describe('formatBrazilian', () => {
  it('formats ISO dates', () => {
    expect(formatBrazilian('2026-09-05')).toBe('05/09/2026')
  })
  it('returns unrecognised input untouched', () => {
    expect(formatBrazilian('hoje')).toBe('hoje')
  })
})

describe('month ranges', () => {
  it('currentMonthRange covers the whole month', () => {
    expect(currentMonthRange(NOW)).toEqual({ start: '2026-10-01', end: '2026-10-31' })
    expect(currentMonthRange(new Date('2028-02-10T12:00:00Z'))).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })

  it('parseMonthPeriod accepts MM/AAAA and mes/AAAA', () => {
    expect(parseMonthPeriod('09/2026')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(parseMonthPeriod('set/2026')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(parseMonthPeriod('FEV/2027')).toEqual({ start: '2027-02-01', end: '2027-02-28' })
  })

  it('parseMonthPeriod rejects garbage', () => {
    expect(parseMonthPeriod('13/2026')).toBeNull()
    expect(parseMonthPeriod('xyz/2026')).toBeNull()
    expect(parseMonthPeriod('2026')).toBeNull()
  })

  it('parseYearMonth builds a valid last day (regression: month filter used "-31")', () => {
    expect(parseYearMonth('2026-09')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(parseYearMonth('2026-13')).toBeNull()
    expect(parseYearMonth('')).toBeNull()
    expect(parseYearMonth(undefined)).toBeNull()
  })

  it('isISODate validates real calendar dates', () => {
    expect(isISODate('2026-02-28')).toBe(true)
    expect(isISODate('2026-02-30')).toBe(false)
    expect(isISODate('26-02-28')).toBe(false)
    expect(isISODate(undefined)).toBe(false)
  })
})

describe('isReasonableDate', () => {
  const now = new Date('2026-10-08T15:00:00Z')

  it('accepts real dates from 2000 until the end of next year', () => {
    expect(isReasonableDate('2026-10-08', now)).toBe(true)
    expect(isReasonableDate('2000-01-01', now)).toBe(true)
    expect(isReasonableDate('2027-12-31', now)).toBe(true)
  })

  it('rejects typos that would corrupt reports', () => {
    for (const v of ['1999-12-31', '2028-01-01', '0026-09-15', '2026-02-30', '2026-9-1', '', null, undefined]) {
      expect(isReasonableDate(v, now)).toBe(false)
    }
  })
})
