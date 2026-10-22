import { describe, expect, it } from 'vitest'
import { decodePlan, encodePlan, type Plan } from './plan'

describe('share links', () => {
  const plan: Plan = {
    start: '08:30',
    mode: 'transit',
    stops: [
      { key: 'places:pl-lalbagh', stay: 120 },
      { key: 'food:f-mtr', stay: 60 },
    ],
  }

  it('round-trips a plan through the link code', () => {
    expect(decodePlan(encodePlan(plan))).toEqual(plan)
  })

  it('uses only link-safe characters', () => {
    expect(encodePlan(plan)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('rejects garbage', () => {
    expect(decodePlan('not-a-real-code!!')).toBeNull()
  })

  it('drops stops that do not exist', () => {
    const tampered = encodePlan({ ...plan, stops: [...plan.stops, { key: 'places:does-not-exist', stay: 30 }] })
    expect(decodePlan(tampered)?.stops).toHaveLength(2)
  })

  it('rejects links with a made-up mode or an impossible time', () => {
    // "constructor" exists on every JavaScript object, so a naive check would accept it
    const fake = (text: string) => btoa(text).replace(/=+$/, '')
    expect(decodePlan(fake('0900.constructor.'))).toBeNull()
    expect(decodePlan(fake('2599.car.'))).toBeNull()
  })
})
