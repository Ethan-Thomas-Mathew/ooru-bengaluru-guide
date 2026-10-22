import { describe, expect, it } from 'vitest'
import { autoFare, isNight, metroFare } from './fares'

describe('autoFare', () => {
  it('charges the minimum for the first 2 km', () => {
    expect(autoFare(1)).toBe(36)
    expect(autoFare(2)).toBe(36)
  })
  it('adds ₹18 per km after that', () => {
    expect(autoFare(5)).toBe(36 + 3 * 18)
  })
  it('is 1.5 times at night', () => {
    expect(autoFare(5, true)).toBe(Math.round((36 + 3 * 18) * 1.5))
  })
  it('knows night hours', () => {
    expect(isNight(23 * 60)).toBe(true)
    expect(isNight(4 * 60)).toBe(true)
    expect(isNight(12 * 60)).toBe(false)
  })
})

describe('metroFare', () => {
  it('follows the distance slabs', () => {
    expect(metroFare(1.5)).toBe(10)
    expect(metroFare(7)).toBe(40)
    expect(metroFare(12)).toBe(60)
    expect(metroFare(40)).toBe(90)
  })
  it('gives 5% off with a smart card', () => {
    expect(metroFare(12, true)).toBe(57)
  })
})
