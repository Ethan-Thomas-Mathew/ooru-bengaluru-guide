// ---------------------------------------------------------------
// fares.ts
// Fare estimates for autos and Namma Metro.
//
// Auto (from 1 Aug 2025): ₹36 for the first 2 km, then ₹18 per km.
// Night (10 PM to 5 AM): 1.5 times the normal fare.
// Metro (from Feb 2025): ₹10 to ₹90 by distance, 5% off with a smart card.
// Sources are listed in the README.
// ---------------------------------------------------------------

export const AUTO = { baseFare: 36, baseKm: 2, perKm: 18, nightMultiplier: 1.5, nightStart: 22 * 60, nightEnd: 5 * 60 }

/** Is this time (minutes after midnight) in the night-fare window? */
export const isNight = (minuteOfDay: number) => {
  const m = ((minuteOfDay % 1440) + 1440) % 1440
  return m >= AUTO.nightStart || m < AUTO.nightEnd
}

/** Auto fare in rupees for a road distance in km */
export function autoFare(km: number, night = false): number {
  const day = km <= AUTO.baseKm ? AUTO.baseFare : AUTO.baseFare + (km - AUTO.baseKm) * AUTO.perKm
  return Math.round(night ? day * AUTO.nightMultiplier : day)
}

// [up to this many km, fare in ₹]
export const METRO_SLABS: [number, number][] = [
  [2, 10],
  [4, 20],
  [6, 30],
  [8, 40],
  [10, 50],
  [15, 60],
  [20, 70],
  [25, 80],
  [Infinity, 90],
]

/** Metro token fare for a track distance in km (smart card = 5% off) */
export function metroFare(km: number, smartCard = false): number {
  const fare = METRO_SLABS.find(([upTo]) => km <= upTo)![1]
  return smartCard ? Math.round(fare * 0.95) : fare
}
