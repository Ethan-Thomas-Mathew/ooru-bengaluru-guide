// ---------------------------------------------------------------
// enrich.ts
// Adds handy computed fields to every listing:
//   nearestMetro + metroWalkMins  -> "Jayanagar metro, about 6 min walk"
//   commuteMins (PGs only)        -> bus/metro minutes to the PG's college
// Runs once when data loads (bundled data, then again for server data).
// ---------------------------------------------------------------

import type { BaseItem, Pg } from '../../shared/types'
import { CATEGORIES, type Category } from '../data/categories'
import { coordsFor, ROAD_FACTOR } from './geo'
import { nearestStation } from './transit'
import { travel } from './itinerary'

const WALK_KMH = 4.5
// We only know the area centre, so anything above ~25 min isn't "walking distance"
const MAX_WALK_MINS = 25

export function addMetroInfo(item: BaseItem): void {
  const c = coordsFor(item)
  const near = c && nearestStation(c)
  if (!near) return
  const mins = Math.max(3, Math.round(((near.km * ROAD_FACTOR) / WALK_KMH) * 60))
  if (mins <= MAX_WALK_MINS) {
    item.nearestMetro = near.name
    item.metroWalkMins = mins
  } else {
    delete item.nearestMetro
    delete item.metroWalkMins
  }
}

/** Bus/metro minutes from any listing to a college, at a normal hour (10 AM) */
export function commuteMinutes(from: BaseItem, college: BaseItem): number {
  return travel(from, college, 'transit', 10 * 60).minutes
}

/** Run every enrichment over every category */
export function enrichAll(categories: Category[] = CATEGORIES): void {
  const colleges = categories.find((c) => c.id === 'colleges')?.data ?? []
  for (const cat of categories) {
    for (const item of cat.data) {
      addMetroInfo(item)
      if (cat.id === 'pgs') {
        const pg = item as Pg
        const college = colleges.find((c) => c.id === pg.collegeId)
        if (college) pg.commuteMins = commuteMinutes(pg, college)
        else delete pg.commuteMins
      }
    }
  }
}
