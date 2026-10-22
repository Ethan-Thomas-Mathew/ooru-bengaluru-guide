// ---------------------------------------------------------------
// filters.ts
// Applies the filter choices + sorting to a list of items.
// Pure functions: same input -> same output, no side effects.
// That makes them easy to test (see filters.test.ts).
// ---------------------------------------------------------------

import type { BaseItem } from '../../shared/types'
import { field, type Category, type FilterDef } from '../data/categories'

/** The value of every filter on screen, keyed by filter.key */
export type FilterState = Record<string, string[] | number | boolean>

// Every option for a 'multi' filter, read from the data itself.
// Example: area filter for gyms -> ["Banashankari", "Basavanagudi", ...]
export function optionsFor(category: Category, filter: FilterDef): string[] {
  const values = category.data.flatMap((item) => {
    const v = field(item, filter.field)
    return Array.isArray(v) ? v : [v]
  })
  return [...new Set(values)].filter((v): v is string => typeof v === 'string' && v !== '').sort()
}

// Highest value of a numeric field (used as the slider's max)
export function maxFor(category: Category, filter: FilterDef): number {
  return Math.max(0, ...category.data.map((item) => Number(field(item, filter.field)) || 0))
}

// An empty filter state for a category: nothing ticked, sliders at max
export function emptyFilters(category: Category): FilterState {
  const state: FilterState = {}
  for (const f of category.filters) {
    if (f.type === 'multi') state[f.key] = []
    if (f.type === 'minRating') state[f.key] = 0
    if (f.type === 'toggle') state[f.key] = false
    if (f.type === 'max') state[f.key] = maxFor(category, f)
  }
  return state
}

// Does one item pass ONE filter?
// `sliderMax` is the slider's highest value (only used by 'max' filters).
function passes(item: BaseItem, filter: FilterDef, value: FilterState[string], sliderMax: number): boolean {
  const v = field(item, filter.field)
  switch (filter.type) {
    case 'multi': {
      const ticked = value as string[]
      if (ticked.length === 0) return true // nothing ticked = no restriction
      const itemValues = Array.isArray(v) ? v : [v]
      return itemValues.some((x) => ticked.includes(x as string))
    }
    case 'minRating':
      return (Number(v) || 0) >= (value as number)
    case 'max':
      // Unknown price (null): we can't say it's under your limit, so it only
      // shows while the slider is untouched (at its maximum).
      if (v == null) return (value as number) >= sliderMax
      return Number(v) <= (value as number)
    case 'toggle':
      if (!value) return true
      return filter.test ? filter.test(v) : v === true
  }
}

// Events whose date has passed are hidden
function isUpcoming(item: BaseItem, today: string): boolean {
  const e = item as BaseItem & { date?: string | null; endDate?: string }
  return !e.date || (e.endDate || e.date) >= today
}

// Main function: filter -> sort
export function applyFilters(category: Category, state: FilterState, sortKey: string): BaseItem[] {
  let items = category.data

  if (category.id === 'events') {
    const today = new Date().toISOString().slice(0, 10)
    items = items.filter((e) => isUpcoming(e, today))
  }

  // Keep items that pass EVERY filter
  const empty = emptyFilters(category)
  items = items.filter((item) =>
    category.filters.every((f) => passes(item, f, state[f.key], Number(empty[f.key]) || 0)),
  )

  // Sort (copy first with [...items] so we don't change the original array).
  // Missing values (undated events, PGs with no college) always go last.
  const sort = category.sorts.find((s) => s.key === sortKey) ?? category.sorts[0]
  return [...items].sort((a, b) => {
    const x = field(a, sort.field) as number | string | null | undefined
    const y = field(b, sort.field) as number | string | null | undefined
    if (x == null && y == null) return 0
    if (x == null) return 1
    if (y == null) return -1
    if (x === y) return 0
    const result = x > y ? 1 : -1
    return sort.dir === 'asc' ? result : -result
  })
}

// How many filters are currently active (for the "Filters (3)" badge)
export function countActive(category: Category, state: FilterState): number {
  const empty = emptyFilters(category)
  return category.filters.filter((f) => JSON.stringify(state[f.key]) !== JSON.stringify(empty[f.key])).length
}
