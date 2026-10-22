// ---------------------------------------------------------------
// itinerary.ts
// The maths behind the day planner. No React in here, just functions:
//   travel()         how long one hop takes (mode, time of day, rain)
//   buildSchedule()  arrival and leaving time for every stop + totals
//   bestOrder()      re-orders stops to cut travel (greedy + 2-opt)
//   bestStartTime()  "leave at 8:15 instead of 9:00 and save 25 min"
// ---------------------------------------------------------------

import type { BaseItem, CategoryId } from '../../shared/types'
import { getCategory } from '../data/categories'
import { coordsFor, distanceKm, ROAD_FACTOR } from './geo'
import { trafficFactor, FLOOD_AREAS, OUTDOOR_KINDS, floodSpot } from './traffic'
import { autoFare, isNight } from './fares'

// ---- Travel modes ------------------------------------------------
// speed = average city speed in km/h with normal traffic
// extra = fixed minutes per hop (finding a cab, parking, waiting for a bus)
export const MODES = {
  car: { label: 'Car or cab', speed: 24, extra: 6 },
  bike: { label: 'Bike or scooter', speed: 27, extra: 3 },
  transit: { label: 'Bus and metro', speed: 19, extra: 12 },
  walk: { label: 'Walking', speed: 4.5, extra: 0 },
} as const
export type ModeKey = keyof typeof MODES

export interface Hop {
  km: number | null
  minutes: number
  /** How much slower than normal (1.5 = 50% slower) */
  slowdown: number
}

/** One hop from `from` to `to`, leaving at `departAt` (minutes after midnight) */
export function travel(from: BaseItem, to: BaseItem, mode: ModeKey, departAt = 600, rain = false): Hop {
  const a = coordsFor(from)
  const b = coordsFor(to)
  if (!a || !b) return { km: null, minutes: 30, slowdown: 1 } // unknown place: assume 30 min
  const m = MODES[mode]
  // Two places in the same area are still ~1 km apart
  const km = Math.max(distanceKm(a, b) * ROAD_FACTOR, 1)
  const slowdown = trafficFactor(mode, { departAt, rain, fromArea: from.area, toArea: to.area })
  const minutes = Math.round((km / m.speed) * 60 * slowdown + m.extra)
  return { km: Math.round(km * 10) / 10, minutes, slowdown }
}

// ---- Time helpers ------------------------------------------------
// "09:30" -> 570 (minutes after midnight), and back again
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export function toHHMM(mins: number): string {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
export function clock(mins: number): string {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m % 60).padStart(2, '0')} ${ampm}`
}
// 400 -> "6 h 40 min"
export function duration(mins: number): string {
  const total = Math.round(mins)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

// Read opening hours like "6 AM – 7 PM" or "9:30 AM – 6 PM (closed Mon)"
export function parseHours(timings: string | undefined): { open: number; close: number } | null {
  if (!timings) return null
  const m = timings.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i)
  if (!m) return null
  const part = (h: string, min: string | undefined, ap: string) =>
    ((Number(h) % 12) + (ap.toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(min || 0)
  return { open: part(m[1], m[2], m[3]), close: part(m[4], m[5], m[6]) }
}

// How long to spend at a stop if the person hasn't changed it
export function defaultStay(categoryId: CategoryId, item: BaseItem): number {
  return item.visitMins ?? getCategory(categoryId)?.visitMins ?? 60
}

// ---- The schedule ------------------------------------------------
export interface Stop {
  key: string
  categoryId: CategoryId
  item: BaseItem
  stay: number
}
export interface ScheduleRow extends Stop {
  leg: Hop | null
  arrive: number
  leave: number
  notes: string[]
}
export interface Schedule {
  rows: ScheduleRow[]
  start: number
  end: number
  total: number
  travelTotal: number
  stayTotal: number
  waitTotal: number
  km: number
  /** Rough auto fare for all hops (car mode only) */
  autoCost: number | null
}

export function buildSchedule(stops: Stop[], start: string, mode: ModeKey, rain = false): Schedule {
  let now = toMinutes(start)
  let travelTotal = 0
  let stayTotal = 0
  let waitTotal = 0
  let kmTotal = 0
  let autoCost = 0
  const rows: ScheduleRow[] = []

  stops.forEach((stop, i) => {
    const notes: string[] = []

    // 1. Travel from the previous stop (traffic depends on when you leave)
    let leg: Hop | null = null
    if (i > 0) {
      leg = travel(stops[i - 1].item, stop.item, mode, now, rain)
      if (leg.slowdown >= 1.4)
        notes.push(
          `Heavy traffic on the way (${clock(now)}), trip takes ${Math.round((leg.slowdown - 1) * 100)}% longer`,
        )
      if (mode === 'car' && leg.km) autoCost += autoFare(leg.km, isNight(now))
      now += leg.minutes
      travelTotal += leg.minutes
      kmTotal += leg.km ?? 0
    }

    // 2. If we arrive before it opens, wait
    const timings = (stop.item as BaseItem & { timings?: string }).timings
    const hours = parseHours(timings)
    let arrive = now
    if (hours && arrive < hours.open) {
      const wait = hours.open - arrive
      notes.push(`Opens at ${clock(hours.open)}, so you wait ${duration(wait)}`)
      waitTotal += wait
      arrive = hours.open
    }
    const leave = arrive + stop.stay
    if (hours && leave > hours.close) notes.push(`Closes at ${clock(hours.close)}, so you'd have to leave early`)
    const closedDay = timings?.match(/\(([^)]*closed[^)]*)\)/i)?.[1]
    if (closedDay) notes.push(closedDay.charAt(0).toUpperCase() + closedDay.slice(1))

    // 3. Rain warnings
    if (rain) {
      const kind = (stop.item as BaseItem & { kind?: string }).kind
      if (kind && OUTDOOR_KINDS.has(kind)) notes.push('Outdoors: not great in heavy rain')
      if (FLOOD_AREAS.has(stop.item.area)) notes.push(`Waterlogging reported nearby: ${floodSpot(stop.item.area)}`)
    }
    if (!coordsFor(stop.item)) notes.push('Exact location unknown, travel time is a guess')

    stayTotal += stop.stay
    rows.push({ ...stop, leg, arrive, leave, notes })
    now = leave
  })

  const startMins = toMinutes(start)
  return {
    rows,
    start: startMins,
    end: now,
    total: now - startMins,
    travelTotal,
    stayTotal,
    waitTotal,
    km: Math.round(kmTotal * 10) / 10,
    autoCost: mode === 'car' && stops.length > 1 ? autoCost : null,
  }
}

// ---- Best start time -----------------------------------------------
// Try starting earlier/later (every 15 min, from 1.5 h before to 2 h after)
// and find the start with the least time stuck travelling + waiting.
export function bestStartTime(stops: Stop[], start: string, mode: ModeKey, rain = false) {
  if (stops.length < 2) return null
  const base = buildSchedule(stops, start, mode, rain)
  const cost = (s: Schedule) => s.travelTotal + s.waitTotal
  let best = { start, saves: 0 }
  for (let offset = -90; offset <= 120; offset += 15) {
    const t = toMinutes(start) + offset
    if (t < 5 * 60 || t > 20 * 60) continue // keep it to sensible hours
    const s = buildSchedule(stops, toHHMM(t), mode, rain)
    const saves = cost(base) - cost(s)
    if (saves > best.saves) best = { start: toHHMM(t), saves }
  }
  return best.saves >= 10 ? best : null // only worth mentioning if it saves 10+ min
}

// ---- Best order --------------------------------------------------
// Visiting N places in the shortest order is the "Travelling Salesman
// Problem" (too slow to solve exactly for big N). Two classic shortcuts:
//   1. Greedy nearest neighbour: from where you are, go to the closest
//      place you haven't visited yet.
//   2. 2-opt: try reversing chunks of the route; keep any change that
//      makes it shorter. Repeat until nothing improves.
// The first stop stays first (that's where your day starts).
export function bestOrder<T extends { item: BaseItem }>(stops: T[]): T[] {
  if (stops.length < 3) return stops
  const dist = (a: T, b: T) => {
    const p = coordsFor(a.item)
    const q = coordsFor(b.item)
    return p && q ? distanceKm(p, q) : 10
  }

  // 1. Greedy
  const left = stops.slice(1)
  const route = [stops[0]]
  while (left.length) {
    const here = route[route.length - 1]
    let bestIndex = 0
    left.forEach((s, i) => {
      if (dist(here, s) < dist(here, left[bestIndex])) bestIndex = i
    })
    route.push(left.splice(bestIndex, 1)[0])
  }

  // 2. 2-opt improvement
  const length = (r: T[]) => r.slice(1).reduce((sum, s, i) => sum + dist(r[i], s), 0)
  let best = route
  let improved = true
  while (improved) {
    improved = false
    for (let i = 1; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)]
        if (length(candidate) + 0.01 < length(best)) {
          best = candidate
          improved = true
        }
      }
    }
  }
  return best
}
