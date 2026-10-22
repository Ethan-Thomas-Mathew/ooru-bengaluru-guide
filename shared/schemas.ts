// ---------------------------------------------------------------
// shared/schemas.ts
// Validation rules written with zod. A schema describes what valid
// input looks like; `schema.safeParse(data)` tells you if data fits.
//
// The server uses these to reject bad requests. The admin form uses
// the SAME rules to show errors before sending, so they never disagree.
// ---------------------------------------------------------------

import { z } from 'zod'
import { CATEGORY_IDS } from './types'

// "colleges:c-christ" -> category id, colon, item id
export const listingKeySchema = z
  .string()
  .regex(/^[a-z]+:[a-z0-9-]+$/, 'Invalid listing key')
  .refine((k) => (CATEGORY_IDS as readonly string[]).includes(k.split(':')[0]), 'Unknown category')

export const newReviewSchema = z.object({
  listingKey: listingKeySchema,
  name: z.string().trim().min(2, 'Name must be at least 2 letters').max(40, 'Name is too long'),
  rating: z.number().int().min(1).max(5),
  text: z
    .string()
    .trim()
    .min(10, 'Write at least 10 characters')
    .max(800, 'Keep it under 800 characters')
    // Most spam contains links, so we don't allow them
    .refine((t) => !/https?:\/\/|www\./i.test(t), 'Links are not allowed in reviews'),
})
export type NewReview = z.infer<typeof newReviewSchema>

// ---- Listings added by the admin ----------------------------------
// Fields every listing can have. No `rating`: ratings only come from reviews.
const base = {
  name: z.string().trim().min(2).max(120),
  area: z.string().trim().min(2).max(60),
  address: z.string().trim().max(200).optional(),
  // Where the facts came from, so visitors can check them
  source: z.string().trim().url('Source must be a full link (https://...)').max(500).optional(),
  checked: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  priceNote: z.string().trim().max(200).optional(),
}
const list = z.array(z.string().trim().min(1).max(60)).max(20)
const money = z.number().int().min(0).max(10_000_000)
// A price the place may not publish: leave it out rather than guess
const maybeMoney = money.optional()

// One schema per category. `satisfies` makes TypeScript check we
// covered every category id.
export const itemSchemas = {
  colleges: z.object({
    ...base,
    level: z.enum(['Degree', 'PUC']),
    type: z.string().min(2).max(60),
    ownership: z.string().min(2).max(40),
    courses: list,
    feesPerYear: maybeMoney,
  }),
  schools: z.object({ ...base, board: list, gender: z.string().min(2).max(20), feesPerYear: maybeMoney }),
  pgs: z.object({
    ...base,
    gender: z.enum(['Boys', 'Girls', 'Co-living']),
    nearCollege: z.string().max(120),
    sharing: list,
    rentPerMonth: money,
    food: z.boolean(),
    amenities: list,
  }),
  gyms: z.object({
    ...base,
    type: z.string().min(2).max(40),
    monthlyFee: maybeMoney,
    open24x7: z.boolean(),
    womenOnly: z.boolean(),
    amenities: list,
  }),
  food: z.object({
    ...base,
    cuisine: z.string().min(2).max(40),
    diet: z.enum(['Veg', 'Non-veg', 'Both']),
    costForTwo: money,
    knownFor: z.string().max(120),
  }),
  rentals: z.object({
    ...base,
    provider: z.string().min(2).max(60),
    vehicleType: z.enum(['Bike', 'Scooter', 'Car']),
    model: z.string().max(80),
    pricePerDay: maybeMoney,
    deposit: maybeMoney,
  }),
  places: z.object({
    ...base,
    kind: z.string().min(2).max(40),
    group: z.enum(['Religious', 'Sightseeing']),
    entryFee: maybeMoney,
    timings: z.string().max(80),
    visitMins: z.number().int().min(10).max(600),
  }),
  showrooms: z.object({ ...base, brand: z.string().min(2).max(40), segment: list, services: list }),
  events: z.object({
    ...base,
    kind: z.string().min(2).max(40),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    venue: z.string().min(2).max(120),
    distances: list,
    organizer: z.string().min(2).max(120),
  }),
} satisfies Record<(typeof CATEGORY_IDS)[number], z.ZodType>

export const newListingSchema = z.object({
  categoryId: z.enum(CATEGORY_IDS),
  item: z.record(z.string(), z.unknown()),
})
