// ---------------------------------------------------------------
// Planner.tsx  (/plan)
// The day planner (itinerary maker). You add places, pick how you'll
// travel and when you start; it works out arrival times, travel time
// (with time-of-day traffic and rain), and how long the day takes.
//
// Shared plans arrive as /plan?p=CODE. They're shown read-only until
// you press "Use this plan".
// The maths lives in lib/itinerary.ts; this file is just the screen.
// ---------------------------------------------------------------

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { mustCategory } from '../data/categories'
import { usePlan, savePlan, lookup, togglePlanStop, decodePlan, shareUrl, type Plan, type PlanStop } from '../lib/plan'
import {
  MODES,
  buildSchedule,
  bestOrder,
  bestStartTime,
  clock,
  duration,
  defaultStay,
  type ModeKey,
  type Stop,
} from '../lib/itinerary'
import { timeBand } from '../lib/traffic'
import { getSuggestions } from '../lib/search'
import { placeUrl } from '../lib/urls'
import { pinFor } from '../lib/geo'
import { countTo, drawRouteLegs, useFlip } from '../lib/motion'
import { useRainMode, setRainMode } from '../lib/prefs'
import { useData } from '../lib/dataContext'
import { usePageTitle } from '../lib/usePageTitle'
import type { MapPoint } from '../components/MapView'

const MapView = lazy(() => import('../components/MapView'))

// Choices for "time here" (minutes)
const STAY_OPTIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480]

// A ready-made classic day, so the page isn't empty the first time
const SAMPLE_DAY = [
  'food:f-ctr',
  'places:pl-iskcon',
  'places:pl-palace',
  'places:pl-cubbon',
  'places:pl-vitm',
  'food:f-koshys',
  'places:pl-commercial',
]
// Quick-add buttons
const POPULAR = [
  'places:pl-lalbagh',
  'places:pl-cubbon',
  'places:pl-palace',
  'places:pl-iskcon',
  'places:pl-bull',
  'food:f-mtr',
  'food:f-vb',
  'food:f-thindibeedi',
  'places:pl-ubcity',
]

const BAND_LABEL = { peak: 'rush hour', shoulder: 'busy', normal: 'normal traffic', night: 'night' }

// ---- Add a stop by typing a name ------------------------------------
function AddStop({ planKeys, onAdd }: { planKeys: string[]; onAdd: (key: string) => void }) {
  const [text, setText] = useState('')
  const matches = getSuggestions(text).filter((s) => s.kind === 'place')

  return (
    <div className="add-stop">
      <label htmlFor="add-stop-input">Add a place</label>
      <input
        id="add-stop-input"
        type="search"
        value={text}
        autoComplete="off"
        placeholder="Type a name, e.g. Lalbagh or MTR"
        onChange={(e) => setText(e.target.value)}
      />
      {text.length >= 2 && (
        <ul className="add-results">
          {matches.length === 0 && <li className="muted small">No places match "{text}"</li>}
          {matches.map((m) =>
            m.kind === 'place' ? (
              <li key={m.label}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(`${m.categoryId}:${m.itemId}`)
                    setText('')
                  }}
                >
                  <span className="sugg-label">{m.label}</span>
                  <span className="sugg-sub">{m.sub}</span>
                </button>
              </li>
            ) : null,
          )}
        </ul>
      )}
      <p className="muted small add-popular-title">Popular</p>
      <ul className="chips">
        {POPULAR.filter((k) => !planKeys.includes(k)).map((k) => {
          const found = lookup(k)
          return found ? (
            <li key={k}>
              <button type="button" className="chip" onClick={() => onAdd(k)}>
                + {found.item.name.replace(/ \(.*\)$/, '')}
              </button>
            </li>
          ) : null
        })}
      </ul>
    </div>
  )
}

// ---- Share the plan ---------------------------------------------------
function ShareButton({ plan }: { plan: Plan }) {
  const [state, setState] = useState<'idle' | 'copied'>('idle')
  const share = async () => {
    const url = shareUrl(plan)
    // Phones: the native share sheet (WhatsApp etc). Desktop: copy the link.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Bengaluru day plan', url })
        return
      } catch {
        /* user closed the share sheet: fall through to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setState('copied')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }
  return (
    <button type="button" className="btn btn-quiet" onClick={share} disabled={!plan.stops.length}>
      {state === 'copied' ? 'Link copied' : 'Share plan'}
    </button>
  )
}

// ---- The page ---------------------------------------------------------
export default function Planner() {
  usePageTitle('Day planner')
  const [params, setParams] = useSearchParams()
  const myPlan = usePlan()
  const rain = useRainMode()
  const { version } = useData()

  // A shared plan from the link, if there is one (read-only until accepted)
  const sharedCode = params.get('p')
  const shared = useMemo(() => (sharedCode ? decodePlan(sharedCode) : null), [sharedCode])
  const plan = shared ?? myPlan
  const readOnly = !!shared

  const update = (changes: Partial<Plan>) => savePlan({ ...plan, ...changes })

  // Turn saved keys back into real listings
  const stops: Stop[] = useMemo(
    () =>
      plan.stops.flatMap((s) => {
        const found = lookup(s.key)
        return found ? [{ ...found, key: s.key, stay: s.stay }] : []
      }),
    // version: re-run when fresh data arrives from the server
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan.stops, version],
  )
  const schedule = useMemo(
    () => buildSchedule(stops, plan.start, plan.mode, rain),
    [stops, plan.start, plan.mode, rain],
  )
  const advice = useMemo(() => bestStartTime(stops, plan.start, plan.mode, rain), [stops, plan.start, plan.mode, rain])
  const points = useMemo<MapPoint[]>(
    () =>
      stops.flatMap((s, i) => {
        const pin = pinFor(s.item)
        return pin
          ? [{ ...pin, label: s.item.name, sub: s.item.area, href: placeUrl(s.categoryId, s.item), number: i + 1 }]
          : []
      }),
    [stops],
  )

  // Smooth re-ordering of the timeline (anime.js createLayout)
  const { ref: listRef, record } = useFlip<HTMLOListElement>('.plan-stop', [plan.stops])

  // Total time counts up/down when it changes
  const totalRef = useRef<HTMLParagraphElement>(null)
  const lastTotal = useRef(0)
  useEffect(() => {
    countTo(totalRef.current, lastTotal.current, schedule.total, duration)
    lastTotal.current = schedule.total
    drawRouteLegs('.plan-leg-bar')
  }, [schedule.total])

  // Every change to the order goes through here so it can animate
  const setStops = (next: PlanStop[]) => {
    record()
    update({ stops: next.map(({ key, stay }) => ({ key, stay })) })
  }
  const move = (i: number, dir: -1 | 1) => {
    const next = [...stops]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]] // swap two items
    setStops(next)
  }
  const remove = (i: number) => setStops(stops.filter((_, k) => k !== i))
  const setStay = (i: number, mins: number) =>
    update({ stops: plan.stops.map((s, k) => (k === i ? { ...s, stay: mins } : s)) })
  const add = (key: string) => {
    const found = lookup(key)
    if (!found || plan.stops.some((s) => s.key === key)) return
    record()
    togglePlanStop(found.categoryId, found.item)
  }
  const loadSample = () =>
    setStops(
      SAMPLE_DAY.flatMap((key) => {
        const f = lookup(key)
        return f ? [{ key, stay: defaultStay(f.categoryId, f.item) }] : []
      }),
    )
  const acceptShared = () => {
    if (shared) savePlan(shared)
    setParams({})
  }

  return (
    <div className="wrap page planner">
      <h1>Day planner</h1>
      <p className="muted lede-small">
        Add places, choose how you'll get around, and see how long your day takes, stop by stop. Travel times change
        with rush hour{rain ? ' and rain' : ''}.
      </p>

      {readOnly && (
        <div className="notice shared-notice">
          <p>You're looking at a plan someone shared with you.</p>
          <div className="row-gap">
            <button type="button" className="btn btn-primary" onClick={acceptShared}>
              Use this plan
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setParams({})}>
              Back to my plan
            </button>
          </div>
        </div>
      )}

      {/* Settings */}
      <fieldset className="plan-settings" disabled={readOnly}>
        <legend className="sr-only">Plan settings</legend>
        <label className="plan-start">
          <span>Start at</span>
          <input type="time" value={plan.start} onChange={(e) => e.target.value && update({ start: e.target.value })} />
        </label>
        <div className="plan-modes" role="radiogroup" aria-label="How you'll travel">
          {(Object.keys(MODES) as ModeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={plan.mode === key}
              onClick={() => update({ mode: key })}
            >
              {MODES[key].label}
            </button>
          ))}
        </div>
        <label className="check rain-check">
          <input type="checkbox" checked={rain} onChange={(e) => setRainMode(e.target.checked)} />
          <span>It's raining</span>
        </label>
        <div className="plan-actions">
          <button
            type="button"
            className="btn btn-quiet"
            disabled={stops.length < 3}
            onClick={() => setStops(bestOrder(stops))}
          >
            Best order
          </button>
          <ShareButton plan={plan} />
          {stops.length > 0 && (
            <button type="button" className="btn btn-quiet" onClick={() => setStops([])}>
              Clear
            </button>
          )}
        </div>
      </fieldset>

      <div className="plan-grid">
        {/* Timeline */}
        <section aria-label="Your stops">
          {stops.length === 0 ? (
            <div className="empty">
              <h2>Your day is empty</h2>
              <p className="muted">Add places from the box on the right, or tap the route button on any listing.</p>
              <button type="button" className="btn btn-primary" onClick={loadSample}>
                Load a sample day
              </button>
            </div>
          ) : (
            <ol className="plan-list" ref={listRef}>
              {schedule.rows.map((row, i) => {
                const category = mustCategory(row.categoryId)
                return (
                  <li key={row.key} className="plan-stop">
                    {/* Travel from the previous stop */}
                    {row.leg && (
                      <div className="plan-leg">
                        <span
                          className={`plan-leg-bar${row.leg.slowdown >= 1.4 ? ' is-slow' : ''}`}
                          aria-hidden="true"
                        />
                        <span>
                          {duration(row.leg.minutes)} by {MODES[plan.mode].label.toLowerCase()}
                          {row.leg.km != null && <>, about {row.leg.km} km</>}
                          {plan.mode !== 'walk' && (
                            <span className="muted">, {BAND_LABEL[timeBand(row.arrive - row.leg.minutes)]}</span>
                          )}
                        </span>
                      </div>
                    )}
                    <div className="plan-row">
                      <div className="plan-time">
                        <strong>{clock(row.arrive)}</strong>
                        <span>to {clock(row.leave)}</span>
                      </div>
                      <span className="plan-dot" aria-hidden="true">
                        {i + 1}
                      </span>
                      <div className="plan-body">
                        <h3>
                          <Link to={placeUrl(row.categoryId, row.item)}>{row.item.name}</Link>
                        </h3>
                        <p className="muted small">
                          {category.name}, {row.item.area}
                        </p>
                        {row.notes.map((n) => (
                          <p key={n} className="plan-note">
                            {n}
                          </p>
                        ))}
                        {!readOnly && (
                          <div className="plan-controls">
                            <label>
                              <span className="sr-only">Time at {row.item.name}</span>
                              <select value={row.stay} onChange={(e) => setStay(i, Number(e.target.value))}>
                                {[...new Set([...STAY_OPTIONS, row.stay])]
                                  .sort((a, b) => a - b)
                                  .map((m) => (
                                    <option key={m} value={m}>
                                      {duration(m)} here
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => move(i, -1)}
                              disabled={i === 0}
                              aria-label={`Move ${row.item.name} earlier`}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => move(i, 1)}
                              disabled={i === stops.length - 1}
                              aria-label={`Move ${row.item.name} later`}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => remove(i)}
                              aria-label={`Remove ${row.item.name}`}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          {points.length > 0 && (
            <div className="plan-map">
              <Suspense fallback={<div className="map-placeholder" style={{ height: 380 }} />}>
                <MapView points={points} route height={380} label="Map of your day plan" />
              </Suspense>
            </div>
          )}
        </section>

        {/* Summary + add */}
        <aside className="plan-side">
          <div className="plan-summary" aria-live="polite">
            <p className="muted small">Your day lasts</p>
            {/* Filled in by countTo() so the number can animate */}
            <p className="plan-total" ref={totalRef} />
            {stops.length > 0 && (
              <p className="plan-span">
                {clock(schedule.start)} to {clock(schedule.end)}
              </p>
            )}
            <dl className="plan-stats">
              <div>
                <dt>Travelling</dt>
                <dd>{duration(schedule.travelTotal)}</dd>
              </div>
              <div>
                <dt>At places</dt>
                <dd>{duration(schedule.stayTotal)}</dd>
              </div>
              {schedule.waitTotal > 0 && (
                <div>
                  <dt>Waiting to open</dt>
                  <dd>{duration(schedule.waitTotal)}</dd>
                </div>
              )}
              <div>
                <dt>Distance</dt>
                <dd>{schedule.km} km</dd>
              </div>
              {schedule.autoCost != null && (
                <div>
                  <dt>By auto, about</dt>
                  <dd>₹{schedule.autoCost}</dd>
                </div>
              )}
              <div>
                <dt>Stops</dt>
                <dd>{stops.length}</dd>
              </div>
            </dl>
            {advice && !readOnly && (
              <div className="plan-advice">
                <p>
                  Start at{' '}
                  <strong>{clock(Number(advice.start.slice(0, 2)) * 60 + Number(advice.start.slice(3)))}</strong> to
                  spend {duration(advice.saves)} less in traffic and queues.
                </p>
                <button type="button" className="btn btn-light" onClick={() => update({ start: advice.start })}>
                  Use this start time
                </button>
              </div>
            )}
            <p className="muted small">
              Estimates use average Bengaluru speeds, rush-hour delays and the centre of each area. Auto fares use the
              August 2025 meter rates.
            </p>
          </div>
          {!readOnly && <AddStop planKeys={plan.stops.map((s) => s.key)} onAdd={add} />}
        </aside>
      </div>
    </div>
  )
}
