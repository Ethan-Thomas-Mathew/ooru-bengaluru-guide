// ---------------------------------------------------------------
// shared/types.ts
// The "shape" of every piece of data on the site. Both the website
// (src/) and the server (server/) import these, so they always agree.
//
// TypeScript checks your code against these shapes BEFORE it runs:
// misspell a field like `item.raitng` and you get a red error.
// ---------------------------------------------------------------

// Every listing has at least these fields
export interface BaseItem {
  id: string
  name: string
  area: string
  /** Average of visitor reviews. Not in the JSON files: filled in from the server */
  rating?: number
  /** Street address, when we have one */
  address?: string
  /** Web page the facts (prices, address) were taken from */
  source?: string
  /** Date we last checked `source`, e.g. "2026-10-22" */
  checked?: string
  /** Extra detail about the price, e.g. "₹19,500 a year incl. GST" */
  priceNote?: string
  /** Minutes someone usually spends there (day planner) */
  visitMins?: number
  /** Added at runtime: minutes' walk to the nearest metro station */
  metroWalkMins?: number
  /** Added at runtime: name of the nearest metro station */
  nearestMetro?: string
}

export interface Nirf {
  category: string
  /** "1", "62", or a band like "101–150" */
  rank: string
}

export interface College extends BaseItem {
  level: 'Degree' | 'PUC'
  type: string
  ownership: string
  courses: string[]
  /** Rough fee per year (varies by course); null = not known */
  feesPerYear: number | null
  nirf: Nirf | null
  /** Number used for sorting: exact rank, start of band, or 999 */
  nirfSort: number
}

export interface School extends BaseItem {
  board: string[]
  gender: string
  /** Rough fee per year; null = not known */
  feesPerYear: number | null
}

export interface Pg extends BaseItem {
  gender: string
  nearCollege: string
  collegeId: string | null
  sharing: string[]
  rentPerMonth: number
  food: boolean
  amenities: string[]
  /** Added at runtime: bus/metro minutes to collegeId */
  commuteMins?: number
}

export interface Gym extends BaseItem {
  type: string
  /** null = the gym doesn't publish it */
  monthlyFee: number | null
  open24x7: boolean
  womenOnly: boolean
  amenities: string[]
  hours?: string
}

export interface FoodPlace extends BaseItem {
  cuisine: string
  diet: string
  /** Approximate */
  costForTwo: number
  knownFor: string
}

export interface Rental extends BaseItem {
  provider: string
  vehicleType: string
  model: string
  /** null = not published */
  pricePerDay: number | null
  /** null = not published, 0 = no deposit */
  deposit: number | null
}

export interface Place extends BaseItem {
  kind: string
  group: 'Religious' | 'Sightseeing'
  /** 0 = free, null = check before going */
  entryFee: number | null
  timings: string
}

export interface Showroom extends BaseItem {
  brand: string
  segment: string[]
  services: string[]
}

export interface EventItem extends BaseItem {
  kind: string
  date: string | null
  endDate?: string
  dateLabel?: string
  venue: string
  distances: string[]
  organizer: string
}

/** Every category id on the site */
export const CATEGORY_IDS = [
  'colleges',
  'schools',
  'pgs',
  'gyms',
  'food',
  'rentals',
  'places',
  'showrooms',
  'events',
] as const
export type CategoryId = (typeof CATEGORY_IDS)[number]

/** What GET /api/listings returns */
export type ListingsByCategory = Record<CategoryId, BaseItem[]>

/** A review as stored and returned by the server */
export interface Review {
  id: number
  listingKey: string // "colleges:c-christ"
  name: string
  rating: number // 1 to 5
  text: string
  createdAt: string // ISO date
  hidden: boolean
}

/** Average rating + count per listing (GET /api/reviews/summary) */
export type ReviewSummary = Record<string, { count: number; average: number }>
