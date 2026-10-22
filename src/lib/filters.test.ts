import { describe, expect, it } from 'vitest'
import { applyFilters, countActive, emptyFilters } from './filters'
import { mustCategory } from '../data/categories'

describe('applyFilters', () => {
  const pgs = mustCategory('pgs')

  it('returns everything with no filters', () => {
    expect(applyFilters(pgs, emptyFilters(pgs), 'rating')).toHaveLength(pgs.data.length)
  })

  it('combines filters with AND', () => {
    const state = { ...emptyFilters(pgs), gender: ['Girls'], rent: 10000 }
    const result = applyFilters(pgs, state, 'rent')
    expect(result.length).toBeGreaterThan(0)
    for (const pg of result) {
      expect((pg as unknown as { gender: string }).gender).toBe('Girls')
      expect((pg as unknown as { rentPerMonth: number }).rentPerMonth).toBeLessThanOrEqual(10000)
    }
    expect(countActive(pgs, state)).toBe(2)
  })

  it('sorts ascending by rent', () => {
    const rents = applyFilters(pgs, emptyFilters(pgs), 'rent').map(
      (p) => (p as unknown as { rentPerMonth: number }).rentPerMonth,
    )
    expect(rents).toEqual([...rents].sort((a, b) => a - b))
  })

  it('keeps unknown prices until you set a price limit', () => {
    const gyms = mustCategory('gyms')
    const fee = (g: unknown) => (g as { monthlyFee: number | null }).monthlyFee
    // Slider untouched: gyms with no published fee are still listed
    const all = applyFilters(gyms, emptyFilters(gyms), 'fee')
    expect(all.some((g) => fee(g) === null)).toBe(true)
    // ...and they go last when sorting by fee
    expect(fee(all[all.length - 1])).toBeNull()
    // Slider moved: only gyms we KNOW are under the limit
    const limited = applyFilters(gyms, { ...emptyFilters(gyms), fee: 2000 }, 'fee')
    expect(limited.length).toBeGreaterThan(0)
    for (const g of limited) expect(fee(g)).not.toBeNull()
  })

  it('hides past events', () => {
    const events = mustCategory('events')
    const today = new Date().toISOString().slice(0, 10)
    for (const e of applyFilters(events, emptyFilters(events), 'date')) {
      const ev = e as unknown as { date: string | null; endDate?: string }
      if (ev.date) expect((ev.endDate ?? ev.date) >= today).toBe(true)
    }
  })
})
