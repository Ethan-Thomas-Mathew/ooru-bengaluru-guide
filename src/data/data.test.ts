// Checks on the data files themselves, so made-up data can't sneak back in
import { describe, expect, it } from 'vitest'
import { CATEGORIES, mustCategory } from './categories'

describe('data files', () => {
  it('have no ratings (ratings only come from reviews)', () => {
    for (const c of CATEGORIES) for (const item of c.data) expect(item.rating, `${c.id}:${item.id}`).toBeUndefined()
  })

  it('link every PG, gym, rental and showroom to where its facts came from', () => {
    for (const id of ['pgs', 'gyms', 'rentals', 'showrooms'] as const) {
      for (const item of mustCategory(id).data) {
        expect(item.source, `${id}:${item.id}`).toMatch(/^https:\/\//)
        expect(item.checked, `${id}:${item.id}`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })

  it('use unique ids in each category', () => {
    for (const c of CATEGORIES) {
      const ids = c.data.map((x) => x.id)
      expect(new Set(ids).size, c.id).toBe(ids.length)
    }
  })
})
