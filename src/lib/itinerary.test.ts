import { describe, expect, it } from 'vitest'
import { bestOrder, bestStartTime, buildSchedule, clock, duration, parseHours, travel, type Stop } from './itinerary'
import { lookup } from './plan'

const stop = (key: string, stay = 60): Stop => {
  const found = lookup(key)
  if (!found) throw new Error(`missing ${key}`)
  return { key, ...found, stay }
}

describe('time helpers', () => {
  it('formats clock times and durations', () => {
    expect(clock(570)).toBe('9:30 AM')
    expect(clock(13 * 60)).toBe('1:00 PM')
    expect(duration(400)).toBe('6 h 40 min')
    expect(duration(45)).toBe('45 min')
  })
  it('reads opening hours', () => {
    expect(parseHours('9:30 AM – 6 PM (closed Mon)')).toEqual({ open: 570, close: 1080 })
    expect(parseHours('Open for prayers')).toBeNull()
  })
})

describe('travel', () => {
  const a = lookup('places:pl-lalbagh')!.item
  const b = lookup('places:pl-cubbon')!.item
  it('is slower at rush hour than mid-day', () => {
    expect(travel(a, b, 'car', 9 * 60).minutes).toBeGreaterThan(travel(a, b, 'car', 14 * 60).minutes)
  })
  it('is slower in rain', () => {
    expect(travel(a, b, 'car', 14 * 60, true).minutes).toBeGreaterThan(travel(a, b, 'car', 14 * 60).minutes)
  })
  it('walking ignores traffic', () => {
    expect(travel(a, b, 'walk', 9 * 60).minutes).toBe(travel(a, b, 'walk', 14 * 60).minutes)
  })
})

describe('buildSchedule', () => {
  it('adds up travel, stays and waiting', () => {
    const s = buildSchedule([stop('food:f-mtr'), stop('places:pl-palace', 90)], '08:00', 'car')
    expect(s.rows).toHaveLength(2)
    expect(s.total).toBe(s.end - s.start)
    expect(s.total).toBe(s.travelTotal + s.stayTotal + s.waitTotal)
    // The palace opens at 10, so arriving earlier means waiting
    expect(s.waitTotal).toBeGreaterThan(0)
    expect(s.autoCost).toBeGreaterThan(0)
  })
})

describe('bestOrder', () => {
  it('keeps the first stop and never makes the route longer', () => {
    const stops = ['food:f-mtr', 'places:pl-palace', 'places:pl-lalbagh', 'places:pl-bull', 'places:pl-cubbon'].map(
      (k) => stop(k),
    )
    const before = buildSchedule(stops, '14:00', 'car').travelTotal
    const ordered = bestOrder(stops)
    expect(ordered[0].key).toBe('food:f-mtr')
    expect(ordered).toHaveLength(stops.length)
    expect(buildSchedule(ordered, '14:00', 'car').travelTotal).toBeLessThanOrEqual(before)
  })
})

describe('bestStartTime', () => {
  it('suggests avoiding rush hour for a driving day', () => {
    const stops = ['places:pl-iskcon', 'places:pl-cubbon', 'places:pl-lalbagh'].map((k) => stop(k, 30))
    const advice = bestStartTime(stops, '08:30', 'car')
    expect(advice).not.toBeNull()
    expect(advice!.saves).toBeGreaterThanOrEqual(10)
  })
})
