import { describe, expect, it } from 'vitest'
import { correctWord, editDistance } from './fuzzy'

describe('editDistance', () => {
  it('is 0 for identical words', () => {
    expect(editDistance('gym', 'gym')).toBe(0)
  })
  it('counts one insert, delete or replace as 1', () => {
    expect(editDistance('gymm', 'gym')).toBe(1) // delete
    expect(editDistance('resturant', 'restaurant')).toBe(1) // insert
    expect(editDistance('biriyani', 'biryani')).toBe(1)
  })
  it('stops early and returns max + 1 when words are far apart', () => {
    expect(editDistance('college', 'temple', 2)).toBe(3)
  })
})

describe('correctWord', () => {
  const vocab = new Set(['college', 'koramangala', 'biryani', 'gym'])
  it('returns known words unchanged', () => {
    expect(correctWord('gym', vocab)).toBe('gym')
  })
  it('fixes small typos', () => {
    expect(correctWord('colege', vocab)).toBe('college')
    expect(correctWord('koramangla', vocab)).toBe('koramangala')
  })
  it('does not guess for short words or numbers', () => {
    expect(correctWord('gim', vocab)).toBeNull()
    expect(correctWord('12000', vocab)).toBeNull()
  })
})
