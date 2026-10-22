// ---------------------------------------------------------------
// transit.ts
// Metro + bus helpers:
//   findMetroRoute()  fewest-stops route between two stations (BFS)
//   nearestStation()  closest metro station to a point
//   findBuses()       direct buses between two stops
// ---------------------------------------------------------------

import transit from '../data/transit.json'
import { distanceKm, type LatLng } from './geo'

export interface MetroLine {
  id: string
  name: string
  color: string
  stations: string[]
}
export interface BusRoute {
  number: string
  type: string
  from: string
  to: string
  via: string[]
  frequency: string
}

export const METRO_LINES: MetroLine[] = transit.metroLines
export const BUS_ROUTES: BusRoute[] = transit.busRoutes

// Station name -> { lat, lng }. Positions are approximate (see README).
export const STATION_COORDS: Record<string, LatLng> = Object.fromEntries(
  Object.entries(transit.stationCoords as Record<string, number[]>).map(([name, [lat, lng]]) => [name, { lat, lng }]),
)

// Every unique station name, sorted A-Z (used for the dropdown suggestions)
export const ALL_STATIONS = [...new Set(METRO_LINES.flatMap((l) => l.stations))].sort()

// Every unique bus stop name (from, to and "via" stops)
export const ALL_STOPS = [...new Set(BUS_ROUTES.flatMap((r) => [r.from, ...r.via, r.to]))].sort()

// Nicknames people actually type -> the station name in our data
const NICKNAMES: Record<string, string> = {
  kempegowda: 'Majestic',
  ksr: 'KSR City Railway Station',
  'city railway station': 'KSR City Railway Station',
  'silk board': 'Central Silk Board',
  ecity: 'Electronic City',
  'e city': 'Electronic City',
  'rv road': 'RV Road',
  airport: 'Kempegowda International Airport',
  kia: 'Kempegowda International Airport',
  'mg road': 'MG Road',
  'jp nagar': 'JP Nagar',
}

// Turn whatever the user typed ("whitefield", "silk board") into a
// real name from `list`. Returns null if nothing looks similar.
export function matchPlace(typed: string | null | undefined, list: string[]): string | null {
  if (!typed) return null
  const t = typed.trim().toLowerCase()
  const nick = NICKNAMES[t]
  if (nick && list.includes(nick)) return nick
  // 1) exact match  2) name starts with it  3) name contains it
  return (
    list.find((s) => s.toLowerCase() === t) ||
    list.find((s) => s.toLowerCase().startsWith(t)) ||
    list.find((s) => s.toLowerCase().includes(t)) ||
    null
  )
}

// ---------------------------------------------------------------
// METRO ROUTE FINDER
// The metro is a graph: each station is a node and neighbouring
// stations on a line are connected. Breadth-First Search (BFS) finds
// the path with the fewest stops. (Same BFS you'll study in DAA.)
// ---------------------------------------------------------------
interface Edge {
  to: string
  line: string
}
const graph: Record<string, Edge[]> = {}
for (const line of METRO_LINES) {
  line.stations.forEach((station, i) => {
    graph[station] ??= []
    if (i > 0) graph[station].push({ to: line.stations[i - 1], line: line.id })
    if (i < line.stations.length - 1) graph[station].push({ to: line.stations[i + 1], line: line.id })
  })
}

export interface RouteStep {
  station: string
  line: string | null
}
export interface MetroRoute {
  steps: RouteStep[]
  changes: number
  stops: number
  minutes: number
  km: number
}

export function findMetroRoute(from: string, to: string): MetroRoute | null {
  if (!graph[from] || !graph[to]) return null
  if (from === to) return { steps: [{ station: from, line: null }], changes: 0, stops: 0, minutes: 0, km: 0 }

  // BFS queue holds stations to visit. `cameFrom` remembers how we reached each one.
  const queue = [from]
  const cameFrom: Record<string, { station: string; line: string } | null> = { [from]: null }

  while (queue.length) {
    const current = queue.shift()!
    if (current === to) break
    for (const edge of graph[current]) {
      if (!(edge.to in cameFrom)) {
        cameFrom[edge.to] = { station: current, line: edge.line }
        queue.push(edge.to)
      }
    }
  }
  if (!(to in cameFrom)) return null

  // Walk backwards from the destination to rebuild the path
  const steps: RouteStep[] = []
  let s: string | null = to
  while (s) {
    const prev: { station: string; line: string } | null = cameFrom[s]
    steps.unshift({ station: s, line: prev ? prev.line : null })
    s = prev ? prev.station : null
  }
  steps[0].line = steps[1].line // the first station gets the line we leave on

  let changes = 0
  for (let i = 2; i < steps.length; i++) if (steps[i].line !== steps[i - 1].line) changes++

  // Track distance = sum of straight hops between consecutive stations
  let km = 0
  for (let i = 1; i < steps.length; i++) {
    const a = STATION_COORDS[steps[i - 1].station]
    const b = STATION_COORDS[steps[i].station]
    if (a && b) km += distanceKm(a, b)
  }

  const stops = steps.length - 1
  // ~2 min per stop + 6 min per interchange
  return { steps, changes, stops, minutes: Math.round(stops * 2 + changes * 6), km: Math.round(km * 10) / 10 }
}

export interface Leg {
  line: string
  stations: string[]
}

// Split the steps into "legs" (one leg per line) for display
export function toLegs(steps: RouteStep[]): Leg[] {
  const legs: Leg[] = []
  for (let i = 1; i < steps.length; i++) {
    const last = legs[legs.length - 1]
    const line = steps[i].line ?? ''
    if (last && last.line === line) last.stations.push(steps[i].station)
    else legs.push({ line, stations: [steps[i - 1].station, steps[i].station] })
  }
  return legs
}

/** The closest metro station to a point, and how far it is (km, straight line) */
export function nearestStation(point: LatLng): { name: string; km: number } | null {
  let best: { name: string; km: number } | null = null
  for (const [name, c] of Object.entries(STATION_COORDS)) {
    const km = distanceKm(point, c)
    if (!best || km < best.km) best = { name, km }
  }
  return best
}

// ---------------------------------------------------------------
// BUS SEARCH: direct buses only (route passes both stops)
// ---------------------------------------------------------------
export function findBuses(from: string, to: string): BusRoute[] {
  return BUS_ROUTES.filter((r) => {
    const stops = [r.from, ...r.via, r.to]
    const a = stops.indexOf(from)
    const b = stops.indexOf(to)
    // Buses run both ways, so either order is fine as long as both stops exist
    return a !== -1 && b !== -1 && a !== b
  })
}
