import { beforeAll, describe, expect, it } from 'vitest'
import { parseQuery, searchEverything, getSuggestions, describeParse } from './search'
import { enrichAll } from './enrich'

beforeAll(() => enrichAll()) // adds metro distances used by "near metro"

// Small helper: parse and expect a category result
function category(q: string) {
  const p = parseQuery(q)
  if (p.type !== 'category') throw new Error(`"${q}" parsed as ${p.type}`)
  return p
}

describe('parseQuery', () => {
  it('finds the category and ticks filters', () => {
    const p = category('bca colleges in jayanagar')
    expect(p.categoryId).toBe('colleges')
    expect(p.filters.courses).toEqual(['BCA'])
    expect(p.filters.area).toEqual(['Jayanagar'])
  })

  it('understands gender, college nickname and a price limit', () => {
    const p = category('girls pg near christ under 12000')
    expect(p.categoryId).toBe('pgs')
    expect(p.filters.gender).toEqual(['Girls'])
    expect(p.filters.nearCollege).toEqual(['Christ University'])
    expect(p.filters.rent).toBe(12000)
  })

  it('reads "5k" as 5000', () => {
    expect(category('gym under 5k').filters.fee).toBe(5000)
  })

  it('fixes typos and says so', () => {
    const p = category('biriyani in koramangla')
    expect(p.corrected).toBe('biryani in koramangala')
    expect(p.filters.cuisine).toEqual(['Biryani'])
  })

  it('turns area nicknames into real areas', () => {
    expect(category('temples in ulsoor').filters.area).toEqual(['Halasuru'])
  })

  it('"pg near metro" is a PG search with the metro filter, not a trip', () => {
    const p = category('pg near metro')
    expect(p.categoryId).toBe('pgs')
    expect(p.filters.nearMetro).toBe(true)
  })

  it('sends "from A to B" to the route planner', () => {
    const p = parseQuery('metro from majestic to whitefield')
    expect(p).toMatchObject({ type: 'transit', mode: 'metro', from: 'Majestic', to: 'Whitefield' })
  })

  it('opens tool pages', () => {
    expect(parseQuery('plan my day')).toMatchObject({ type: 'page', path: '/plan' })
    expect(parseQuery('auto fare')).toMatchObject({ type: 'page', path: '/newcomer' })
    expect(parseQuery('moving to bangalore')).toMatchObject({ type: 'page', path: '/move-in' })
  })

  it('keeps leftover words to rank names', () => {
    expect(category('christ university').words).toEqual(['christ'])
  })

  it('falls back to searching everything', () => {
    const p = parseQuery('mtr')
    expect(p.type).toBe('all')
    const groups = searchEverything(['mtr'])
    expect(groups[0].items[0].name).toContain('MTR')
  })

  it('describes what it understood', () => {
    expect(describeParse(parseQuery('cbse schools in whitefield'))).toBe('Schools: CBSE, Whitefield')
  })
})

describe('getSuggestions', () => {
  it('matches the start of words in names', () => {
    const labels = getSuggestions('kora').map((s) => s.label)
    expect(labels).toContain('Everything in Koramangala')
    expect(labels.some((l) => l.includes('Koramangala'))).toBe(true)
  })
  it('does not match the middle of words', () => {
    expect(getSuggestions('ul').map((s) => s.label)).not.toContain('cult.fit Koramangala')
  })
})

describe('search + filters together', () => {
  it('"pg under 10000" finds PGs at or under that rent', async () => {
    const { applyFilters } = await import('./filters')
    const { mustCategory } = await import('../data/categories')
    const p = category('pg under 10000')
    const results = applyFilters(mustCategory('pgs'), p.filters, p.sort) as unknown as { rentPerMonth: number }[]
    expect(results.length).toBeGreaterThan(0)
    for (const pg of results) expect(pg.rentPerMonth).toBeLessThanOrEqual(10000)
  })

  it('"food near metro" only finds places within a 15 min walk', async () => {
    const { applyFilters } = await import('./filters')
    const { mustCategory } = await import('../data/categories')
    const p = category('food near metro')
    const results = applyFilters(mustCategory('food'), p.filters, p.sort)
    expect(results.length).toBeGreaterThan(0)
    for (const f of results) expect(f.metroWalkMins).toBeLessThanOrEqual(15)
  })
})
