// ---------------------------------------------------------------
// Transit.tsx  (/getting-around)
// Metro route planner (fewest stops) + direct bus finder.
// URL example: /getting-around?mode=metro&from=Majestic&to=Whitefield
// ---------------------------------------------------------------

import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  METRO_LINES,
  BUS_ROUTES,
  ALL_STATIONS,
  ALL_STOPS,
  STATION_COORDS,
  matchPlace,
  findMetroRoute,
  toLegs,
  findBuses,
  type BusRoute,
  type MetroRoute,
} from '../lib/transit'
import { drawRouteLegs } from '../lib/motion'
import { metroFare } from '../lib/fares'
import { usePageTitle } from '../lib/usePageTitle'
import type { MapPoint } from '../components/MapView'

const MapView = lazy(() => import('../components/MapView'))

// CSS custom property for the line colour (TypeScript needs this cast)
const lineColor = (color: string) => ({ '--route': color }) as CSSProperties

const lineById = (id: string) => METRO_LINES.find((l) => l.id === id) ?? METRO_LINES[0]

// ---- Metro result: one coloured block per line you ride ----------
function MetroResult({ route }: { route: MetroRoute | null }) {
  useEffect(() => {
    drawRouteLegs('.leg-bar')
  }, [route])

  if (!route) {
    return <p className="empty-inline">Pick two stations from the list to see the route.</p>
  }
  const legs = toLegs(route.steps)
  return (
    <div className="route">
      <p className="route-summary">
        <strong>About {route.minutes} min</strong>
        <span>{route.stops} stops</span>
        <span>
          {route.changes === 0 ? 'No change' : `${route.changes} ${route.changes === 1 ? 'change' : 'changes'}`}
        </span>
        <span>about {route.km} km</span>
        <span>
          Fare about ₹{metroFare(route.km)} (₹{metroFare(route.km, true)} with a smart card)
        </span>
      </p>
      <ol className="legs">
        {legs.map((leg, i) => {
          const line = lineById(leg.line)
          const middle = leg.stations.slice(1, -1)
          return (
            <li key={i} className="leg" style={lineColor(line.color)}>
              <span className="leg-bar" aria-hidden="true" />
              <p className="leg-station">{leg.stations[0]}</p>
              <p className="leg-line">
                Take the {line.name}
                {i > 0 && ' (change here)'}
              </p>
              {middle.length > 0 && (
                <details>
                  <summary>{middle.length} stops in between</summary>
                  <ul className="leg-stops">
                    {middle.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </details>
              )}
              {i === legs.length - 1 && <p className="leg-station">{leg.stations[leg.stations.length - 1]}</p>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ---- Reusable from/to form --------------------------------------
// It keeps its own text state. The parent gives it a `key`, so when the
// URL changes React creates a fresh form with the new starting values.
interface FromToProps {
  list: string[]
  listId: string
  initialFrom: string
  initialTo: string
  onSubmit: (from: string, to: string) => void
  buttonLabel: string
}

function FromTo({ list, listId, initialFrom, initialTo, onSubmit, buttonLabel }: FromToProps) {
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  return (
    <form
      className="fromto"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(from, to)
      }}
    >
      <label>
        <span>From</span>
        <input list={listId} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="e.g. Majestic" />
      </label>
      <button
        type="button"
        className="swap"
        aria-label="Swap from and to"
        onClick={() => {
          setFrom(to)
          setTo(from)
        }}
      >
        ⇅
      </button>
      <label>
        <span>To</span>
        <input list={listId} value={to} onChange={(e) => setTo(e.target.value)} placeholder="e.g. Whitefield" />
      </label>
      <button type="submit" className="btn btn-primary">
        {buttonLabel}
      </button>
      {/* <datalist> gives free autocomplete suggestions in the browser */}
      <datalist id={listId}>
        {list.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </form>
  )
}

export default function Transit() {
  const [params, setParams] = useSearchParams()
  const mode = params.get('mode') === 'bus' ? 'bus' : 'metro'
  const fromParam = params.get('from') || ''
  const toParam = params.get('to') || ''

  const list = mode === 'metro' ? ALL_STATIONS : ALL_STOPS
  const urlFrom = matchPlace(params.get('from'), list)
  const urlTo = matchPlace(params.get('to'), list)

  // Results are calculated from the URL, so links can be shared
  const metroRoute = useMemo(
    () => (mode === 'metro' && urlFrom && urlTo ? findMetroRoute(urlFrom, urlTo) : null),
    [mode, urlFrom, urlTo],
  )
  const buses = mode === 'bus' && urlFrom && urlTo ? findBuses(urlFrom, urlTo) : null
  usePageTitle('Bus and metro')

  // Stations on the route, as map pins (first and last are numbered)
  const routePoints = useMemo<MapPoint[]>(() => {
    if (!metroRoute || metroRoute.steps.length < 2) return []
    const last = metroRoute.steps.length - 1
    return metroRoute.steps.flatMap((step, i) => {
      const c = STATION_COORDS[step.station]
      if (!c) return []
      const line = METRO_LINES.find((l) => l.id === step.line)
      return [{ ...c, label: step.station, color: line?.color, number: i === 0 ? 1 : i === last ? 2 : undefined }]
    })
  }, [metroRoute])

  const search = (from: string, to: string) => setParams({ mode, from, to })
  const switchMode = (m: 'metro' | 'bus') => setParams({ mode: m, from: fromParam, to: toParam })

  return (
    <div className="wrap page transit">
      <h1>Bus and metro</h1>
      <p className="muted lede-small">
        Plan a trip across the city. Times are estimates, so check the Namma Metro or BMTC app before you leave.
      </p>

      <div className="tabs" role="tablist" aria-label="Travel mode">
        <button role="tab" aria-selected={mode === 'metro'} onClick={() => switchMode('metro')}>
          Metro
        </button>
        <button role="tab" aria-selected={mode === 'bus'} onClick={() => switchMode('bus')}>
          Bus
        </button>
      </div>

      <FromTo
        key={params.toString()}
        list={list}
        listId={`${mode}-places`}
        initialFrom={fromParam}
        initialTo={toParam}
        onSubmit={search}
        buttonLabel={mode === 'metro' ? 'Find route' : 'Find buses'}
      />

      {/* If they typed something we couldn't match, say so */}
      {(params.get('from') || params.get('to')) && (!urlFrom || !urlTo) && (
        <p className="notice">
          We couldn't find {!urlFrom ? `"${params.get('from')}"` : `"${params.get('to')}"`} as a{' '}
          {mode === 'metro' ? 'metro station' : 'bus stop'}. Pick one from the suggestions as you type.
        </p>
      )}

      {mode === 'metro' ? (
        <div className="transit-grid">
          <div>
            <MetroResult route={metroRoute} />
            {routePoints.length > 0 && (
              <Suspense fallback={<div className="map-placeholder" style={{ height: 360 }} />}>
                <MapView points={routePoints} showMetro height={360} label="Map of the metro route" />
              </Suspense>
            )}
          </div>
          <aside className="lines">
            <h2>Lines running now</h2>
            <ul>
              {METRO_LINES.map((l) => (
                <li key={l.id} style={lineColor(l.color)}>
                  <strong>{l.name}</strong>
                  <span className="muted small">
                    {l.stations[0]} to {l.stations[l.stations.length - 1]}, {l.stations.length} stations
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      ) : (
        <div className="bus-results">
          {buses &&
            (buses.length ? (
              <>
                <h2>
                  Direct buses from {urlFrom} to {urlTo}
                </h2>
                <BusList routes={buses} />
              </>
            ) : (
              <p className="notice">No direct bus in the routes we list. Try the metro tab, or a nearby stop.</p>
            ))}
          <h2>All routes we list</h2>
          <BusList routes={BUS_ROUTES} />
        </div>
      )}
    </div>
  )
}

function BusList({ routes }: { routes: BusRoute[] }) {
  return (
    <ul className="bus-list">
      {routes.map((r) => (
        <li key={r.number}>
          <span className="bus-number">{r.number}</span>
          <div>
            <p>
              <strong>{r.from}</strong> to <strong>{r.to}</strong>
            </p>
            <p className="muted small">Via {r.via.join(', ')}</p>
            <p className="muted small">
              {r.type}, {r.frequency.toLowerCase()}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
