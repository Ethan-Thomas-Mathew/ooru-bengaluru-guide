// ---------------------------------------------------------------
// traffic.ts
// How much slower a trip is at a given time of day (and in rain).
//
// Bengaluru traffic peaks roughly 8-11 AM and 5-9 PM, and is worst on
// the Outer Ring Road / Silk Board / Hosur Road / Hebbal stretches.
// These multipliers are our own estimates, not live traffic data.
// ---------------------------------------------------------------

import RAIN from '../data/rain.json'
import type { ModeKey } from './itinerary'

// Areas on the busiest corridors (extra delay at peak hours)
export const CORRIDOR_AREAS = new Set([
  'BTM Layout',
  'HSR Layout',
  'Koramangala',
  'Electronic City',
  'Hosur Road',
  'SG Palya',
  'Marathahalli',
  'Whitefield',
  'Mahadevapura',
  'Hebbal',
  'Sarjapur Road',
  'Old Airport Road',
  'Bannerghatta Road',
  'Hennur',
])

// Areas that flood in heavy rain (from data/rain.json)
export const FLOOD_AREAS = new Set(RAIN.hotspots.map((h) => h.area))
export const OUTDOOR_KINDS = new Set(RAIN.outdoorKinds)
export const floodSpot = (area: string) => RAIN.hotspots.find((h) => h.area === area)?.spot

export type TimeBand = 'peak' | 'shoulder' | 'normal' | 'night'

/** Which part of the day is it? minuteOfDay: 0 = midnight, 540 = 9 AM */
export function timeBand(minuteOfDay: number): TimeBand {
  const h = (((minuteOfDay % 1440) + 1440) % 1440) / 60
  if ((h >= 8 && h < 11) || (h >= 17 && h < 21)) return 'peak'
  if ((h >= 7 && h < 8) || (h >= 11 && h < 12) || (h >= 16 && h < 17) || (h >= 21 && h < 22)) return 'shoulder'
  if (h >= 22 || h < 6) return 'night'
  return 'normal'
}

// Multiplier per time band and travel mode. Walking doesn't care about traffic.
// At night roads are empty, but buses are rare and the metro stops ~11 PM.
const BAND_FACTOR: Record<TimeBand, Record<ModeKey, number>> = {
  peak: { car: 1.5, bike: 1.35, transit: 1.2, walk: 1 },
  shoulder: { car: 1.2, bike: 1.15, transit: 1.1, walk: 1 },
  normal: { car: 1, bike: 1, transit: 1, walk: 1 },
  night: { car: 0.8, bike: 0.8, transit: 1.4, walk: 1 },
}

export interface TrafficOptions {
  departAt: number // minutes after midnight
  rain: boolean
  fromArea: string
  toArea: string
}

/** Total slow-down multiplier for one hop */
export function trafficFactor(mode: ModeKey, o: TrafficOptions): number {
  const band = timeBand(o.departAt)
  let f = BAND_FACTOR[band][mode]
  const onCorridor = CORRIDOR_AREAS.has(o.fromArea) || CORRIDOR_AREAS.has(o.toArea)
  if (band === 'peak' && onCorridor && mode !== 'walk') f *= 1.2
  if (o.rain) {
    f *= mode === 'walk' ? 1.2 : 1.3
    if (FLOOD_AREAS.has(o.fromArea) || FLOOD_AREAS.has(o.toArea)) f *= 1.2
  }
  return f
}
