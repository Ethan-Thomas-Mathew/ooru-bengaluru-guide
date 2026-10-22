import { describe, expect, it } from 'vitest'
import { findMetroRoute, nearestStation, toLegs, findBuses, ALL_STATIONS, STATION_COORDS } from './transit'

describe('metro data', () => {
  it('has a position for every station', () => {
    expect(ALL_STATIONS.filter((s) => !STATION_COORDS[s])).toEqual([])
  })
})

describe('findMetroRoute', () => {
  it('finds a route with interchanges (BFS)', () => {
    const r = findMetroRoute('Kengeri', 'Electronic City')!
    expect(r.changes).toBe(2)
    expect(toLegs(r.steps).map((l) => l.line)).toEqual(['purple', 'green', 'yellow'])
    expect(r.km).toBeGreaterThan(15)
  })
  it('returns null for unknown stations', () => {
    expect(findMetroRoute('Nowhere', 'Majestic')).toBeNull()
  })
})

describe('nearestStation', () => {
  it('finds MG Road from the MG Road area', () => {
    expect(nearestStation({ lat: 12.9756, lng: 77.6066 })?.name).toBe('MG Road')
  })
})

describe('findBuses', () => {
  it('finds direct buses either way', () => {
    expect(findBuses('Majestic', 'Marathahalli').map((b) => b.number)).toContain('335E')
    expect(findBuses('Marathahalli', 'Majestic').map((b) => b.number)).toContain('335E')
  })
})
