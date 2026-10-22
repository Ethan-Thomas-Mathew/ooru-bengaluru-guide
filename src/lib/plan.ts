// ---------------------------------------------------------------
// plan.ts
// The day plan, kept in the browser. Shape:
//   { start: "09:00", mode: "car",
//     stops: [ { key: "places:pl-lalbagh", stay: 120 }, ... ] }
//
// Share links: the whole plan is squeezed into the link itself
// (/plan?p=...), so there's nothing to store on a server.
// ---------------------------------------------------------------

import type { BaseItem, CategoryId } from '../../shared/types'
import { CATEGORY_IDS } from '../../shared/types'
import { getCategory } from '../data/categories'
import { defaultStay, MODES, type ModeKey } from './itinerary'
import { readStored, useStored, writeStored } from './storage'

export interface PlanStop {
  key: string
  stay: number
}
export interface Plan {
  start: string
  mode: ModeKey
  stops: PlanStop[]
}

const KEY = 'ooru-plan'
export const EMPTY_PLAN: Plan = { start: '09:00', mode: 'car', stops: [] }

export const readPlan = () => ({ ...EMPTY_PLAN, ...readStored<Partial<Plan>>(KEY, {}) })
export const savePlan = (plan: Plan) => writeStored(KEY, plan)
export const usePlan = (): Plan => ({ ...EMPTY_PLAN, ...useStored<Partial<Plan>>(KEY, {}) })

// Turn "places:pl-lalbagh" back into { categoryId, item }
export function lookup(key: string): { categoryId: CategoryId; item: BaseItem } | null {
  const [categoryId, id] = key.split(':')
  const category = getCategory(categoryId)
  const item = category?.data.find((x) => x.id === id)
  return category && item ? { categoryId: category.id, item } : null
}

export const inPlan = (plan: Plan, key: string) => plan.stops.some((s) => s.key === key)

// Add or remove one listing
export function togglePlanStop(categoryId: CategoryId, item: BaseItem): void {
  const plan = readPlan()
  const key = `${categoryId}:${item.id}`
  const stops = inPlan(plan, key)
    ? plan.stops.filter((s) => s.key !== key)
    : [...plan.stops, { key, stay: defaultStay(categoryId, item) }]
  savePlan({ ...plan, stops })
}

// ---- Share links ---------------------------------------------------
// The plan becomes a short text like "0900.car.places:pl-lalbagh~120,food:f-mtr~60"
// then base64url (letters, numbers, - and _) so it's safe inside a link.

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const fromBase64Url = (code: string) => {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodePlan(plan: Plan): string {
  const stops = plan.stops.map((s) => `${s.key}~${s.stay}`).join(',')
  return toBase64Url(`${plan.start.replace(':', '')}.${plan.mode}.${stops}`)
}

/** Returns null if the code is broken or was tampered with */
export function decodePlan(code: string): Plan | null {
  try {
    const [time, mode, stopText] = fromBase64Url(code).split('.')
    if (!/^\d{4}$/.test(time) || !(mode in MODES)) return null
    const stops = (stopText ?? '')
      .split(',')
      .filter(Boolean)
      .map((part) => {
        const [key, stay] = part.split('~')
        return { key, stay: Number(stay) }
      })
      // Only keep stops that look valid and still exist
      .filter(
        (s) =>
          (CATEGORY_IDS as readonly string[]).includes(s.key.split(':')[0]) &&
          Number.isInteger(s.stay) &&
          s.stay > 0 &&
          s.stay <= 720 &&
          lookup(s.key) !== null,
      )
      .slice(0, 20)
    return { start: `${time.slice(0, 2)}:${time.slice(2)}`, mode: mode as ModeKey, stops }
  } catch {
    return null
  }
}

export const shareUrl = (plan: Plan) => `${window.location.origin}/plan?p=${encodePlan(plan)}`
