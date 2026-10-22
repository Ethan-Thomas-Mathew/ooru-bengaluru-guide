// ---------------------------------------------------------------
// geo.ts
// Locations and distances. Used by the planner, the map, commute
// scores and fare estimates.
//
// We know the rough centre of each AREA (areas.json), not exact street
// addresses, so every distance here is an estimate.
// ---------------------------------------------------------------

import AREAS_JSON from '../data/areas.json'
import type { BaseItem } from '../../shared/types'

export interface LatLng {
  lat: number
  lng: number
}

interface AreaInfo extends LatLng {
  aliases: string[]
}

// areas.json also has a "_note" key, so we drop it here
export const AREAS: Record<string, AreaInfo> = Object.fromEntries(
  Object.entries(AREAS_JSON).filter(([k]) => k !== '_note'),
) as Record<string, AreaInfo>

export const AREA_NAMES = Object.keys(AREAS)

// Roads aren't straight lines, so road distance is ~35% longer
export const ROAD_FACTOR = 1.35

// Haversine formula: distance between two points on a sphere (Earth)
export function distanceKm(p: LatLng, q: LatLng): number {
  const R = 6371 // Earth's radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(q.lat - p.lat)
  const dLng = toRad(q.lng - p.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p.lat)) * Math.cos(toRad(q.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Centre of an area, or null if we don't know it ("Bengaluru" = unknown) */
export function areaCoords(area: string): LatLng | null {
  const a = AREAS[area]
  if (!a || area === 'Bengaluru') return null
  return { lat: a.lat, lng: a.lng }
}

/** Where a listing is (the centre of its area) */
export const coordsFor = (item: BaseItem) => areaCoords(item.area)

/**
 * Where to draw a map pin. Many listings share an area, so pins would
 * sit on top of each other. We nudge each one by a small, fixed amount
 * worked out from its id (same id = same nudge every time).
 */
export function pinFor(item: BaseItem): LatLng | null {
  const c = coordsFor(item)
  if (!c) return null
  let hash = 0
  for (const ch of item.id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const angle = (Math.abs(hash) % 360) * (Math.PI / 180)
  const radius = 0.0025 + (Math.abs(hash >> 8) % 100) / 40000 // about 250-500 m
  return { lat: c.lat + Math.sin(angle) * radius, lng: c.lng + Math.cos(angle) * radius }
}
