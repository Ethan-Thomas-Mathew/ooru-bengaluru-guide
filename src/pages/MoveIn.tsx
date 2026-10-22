// ---------------------------------------------------------------
// MoveIn.tsx  (/move-in and /move-in/:collegeId)
// "I got into a college. Where do I live and what will it cost?"
//   1. Pick your college
//   2. PGs ranked by commute (bus/metro minutes), filtered by budget
//   3. Cheap food and gyms nearby, nearest metro
//   4. A monthly cost estimate you can adjust
// ---------------------------------------------------------------

import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { College, FoodPlace, Gym, Pg } from '../../shared/types'
import { mustCategory, metroText, price, rupees } from '../data/categories'
import { commuteMinutes } from '../lib/enrich'
import { coordsFor, distanceKm, ROAD_FACTOR } from '../lib/geo'
import { metroFare } from '../lib/fares'
import { placeUrl } from '../lib/urls'
import { toPoints } from '../lib/mapPoints'
import { useData } from '../lib/dataContext'
import { usePageTitle } from '../lib/usePageTitle'
import Rating from '../components/Rating'
import SaveButton from '../components/SaveButton'

const MapView = lazy(() => import('../components/MapView'))

const COMMUTE_DAYS = 22 // college days in a month
// Fixed monthly costs we can't look up (editable on the page)
const DEFAULT_EXTRAS = { phone: 500, misc: 2000 }

// km between two listings by road (null if unknown)
function roadKm(a: { area: string; id: string; name: string }, b: { area: string; id: string; name: string }) {
  const p = coordsFor(a)
  const q = coordsFor(b)
  return p && q ? Math.max(1, distanceKm(p, q) * ROAD_FACTOR) : null
}

export default function MoveIn() {
  const { collegeId } = useParams()
  const navigate = useNavigate()
  const { version } = useData()

  const colleges = mustCategory('colleges').data as College[]
  const college = colleges.find((c) => c.id === collegeId) ?? null
  usePageTitle(college ? `Move-in kit: ${college.name}` : 'Move-in kit')

  // Your preferences
  const [gender, setGender] = useState<'Any' | 'Boys' | 'Girls'>('Any')
  const [budget, setBudget] = useState(15000)
  const [wantGym, setWantGym] = useState(true)
  const [pickedPg, setPickedPg] = useState<string | null>(null)
  const [extras, setExtras] = useState(DEFAULT_EXTRAS)

  // PGs ranked by commute to this college
  const pgs = useMemo(() => {
    if (!college) return []
    return (mustCategory('pgs').data as Pg[])
      .filter((p) => gender === 'Any' || p.gender === gender || p.gender === 'Co-living')
      .filter((p) => p.rentPerMonth <= budget)
      .map((p) => ({ pg: p, mins: commuteMinutes(p, college), km: roadKm(p, college) }))
      .sort((a, b) => a.mins - b.mins || a.pg.rentPerMonth - b.pg.rentPerMonth)
      .slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [college, gender, budget, version])

  // Closest cheap food and gyms
  const nearby = useMemo(() => {
    if (!college) return { food: [] as FoodPlace[], gyms: [] as Gym[] }
    const byDistance = <T extends { area: string; id: string; name: string }>(list: T[]) =>
      list
        .map((x) => ({ x, km: roadKm(x, college) ?? 99 }))
        .sort((a, b) => a.km - b.km)
        .map((r) => r.x)
    return {
      food: byDistance((mustCategory('food').data as FoodPlace[]).filter((f) => f.costForTwo <= 500)).slice(0, 4),
      gyms: byDistance(mustCategory('gyms').data as Gym[]).slice(0, 3),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [college, version])

  const points = useMemo(
    () =>
      college
        ? [
            ...toPoints('colleges', [college]),
            ...toPoints(
              'pgs',
              pgs.map((p) => p.pg),
            ),
            ...toPoints('food', nearby.food),
          ]
        : [],
    [college, pgs, nearby.food],
  )

  // ---- Monthly cost ----------------------------------------------------
  const chosen = pgs.find((p) => p.pg.id === pickedPg) ?? pgs[0]
  const cost = useMemo(() => {
    if (!chosen) return null
    const rent = chosen.pg.rentPerMonth
    // Food: if the PG gives meals, just snacks; otherwise two cheap meals a day
    const avgMeal = nearby.food.length
      ? nearby.food.reduce((s, f) => s + f.costForTwo / 2, 0) / nearby.food.length
      : 150
    const food = chosen.pg.food ? 1500 : Math.round((avgMeal * 2 * 30) / 100) * 100
    // Travel: walkable (≤ 1.5 km) is free; otherwise a metro-like fare both ways
    const travel = chosen.km != null && chosen.km <= 1.5 ? 0 : metroFare(chosen.km ?? 5) * 2 * COMMUTE_DAYS
    // Gym: cheapest PUBLISHED fee nearby. Many gyms don't publish fees, so if
    // none nearby do, fall back to the cheapest published fee in the city.
    const fees = (list: Gym[]) => list.map((g) => g.monthlyFee).filter((f): f is number => f != null)
    const nearbyFees = fees(nearby.gyms)
    const gymFees = nearbyFees.length ? nearbyFees : fees(mustCategory('gyms').data as Gym[])
    const gym = wantGym && gymFees.length ? Math.min(...gymFees) : 0
    const gymNote = !wantGym
      ? 'Not included'
      : nearbyFees.length
        ? 'Cheapest published fee nearby'
        : "Gyms nearby don't publish fees; cheapest published fee in the city"

    const rows: [string, number, string][] = [
      ['Rent', rent, `${chosen.pg.name}, ${chosen.pg.sharing.join('/')} sharing`],
      [
        'Food',
        food,
        chosen.pg.food
          ? 'PG gives meals; this is for snacks and eating out sometimes'
          : 'Two budget meals a day from places nearby',
      ],
      ['Travel', travel, travel ? `Bus or metro both ways, ${COMMUTE_DAYS} days` : 'Walking distance'],
      ['Gym', gym, gymNote],
      ['Phone and internet', extras.phone, 'Change below'],
      ['Everything else', extras.misc, 'Toiletries, laundry, outings. Change below'],
    ]
    return { rows, total: rows.reduce((s, r) => s + r[1], 0) }
  }, [chosen, nearby, wantGym, extras])

  return (
    <div className="wrap page move-in">
      <h1>Move-in kit</h1>
      <p className="muted lede-small">
        Pick your college. We'll find PGs with the shortest commute, cheap food and gyms nearby, and estimate what a
        month costs.
      </p>

      <label className="field college-pick">
        <span>Your college</span>
        <select value={college?.id ?? ''} onChange={(e) => navigate(`/move-in/${e.target.value}`)}>
          <option value="" disabled>
            Choose a college
          </option>
          <optgroup label="Degree">
            {colleges
              .filter((c) => c.level === 'Degree')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </optgroup>
          <optgroup label="PUC">
            {colleges
              .filter((c) => c.level === 'PUC')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </optgroup>
        </select>
      </label>

      {!college ? (
        <div className="empty">
          <h2>Start by choosing your college</h2>
          <p className="muted">Everything below is worked out from where your college is.</p>
        </div>
      ) : (
        <>
          <div className="move-summary">
            <div>
              <h2>
                <Link to={placeUrl('colleges', college)}>{college.name}</Link>
              </h2>
              <p className="muted">
                {college.area}. Nearest metro: {metroText(college)}
              </p>
            </div>
          </div>

          <fieldset className="move-prefs">
            <legend className="sr-only">Your preferences</legend>
            <div className="plan-modes" role="radiogroup" aria-label="PG for">
              {(['Any', 'Boys', 'Girls'] as const).map((g) => (
                <button key={g} type="button" role="radio" aria-checked={gender === g} onClick={() => setGender(g)}>
                  {g === 'Any' ? 'Any PG' : `${g} PG`}
                </button>
              ))}
            </div>
            <label className="field budget">
              <span>Max rent: {rupees(budget)}</span>
              <input
                type="range"
                min={5000}
                max={25000}
                step={500}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
              />
            </label>
            <label className="check">
              <input type="checkbox" checked={wantGym} onChange={(e) => setWantGym(e.target.checked)} />
              <span>Include a gym</span>
            </label>
          </fieldset>

          <div className="move-grid">
            <section aria-labelledby="pg-title">
              <h2 id="pg-title">PGs with the shortest commute</h2>
              {pgs.length === 0 ? (
                <p className="notice">No PGs under {rupees(budget)} match. Raise your budget or pick "Any PG".</p>
              ) : (
                <ol className="pg-rank">
                  {pgs.map(({ pg, mins, km }) => (
                    <li key={pg.id} className={chosen?.pg.id === pg.id ? 'is-picked' : ''}>
                      <div className="pg-rank-head">
                        <Link to={placeUrl('pgs', pg)}>{pg.name}</Link>
                        <Rating item={pg} categoryId="pgs" />
                        <SaveButton categoryId="pgs" item={pg} />
                      </div>
                      <p className="muted small">
                        {pg.gender}, {pg.area}. {rupees(pg.rentPerMonth)}/mo, {pg.food ? 'meals included' : 'no meals'}
                      </p>
                      <p className="commute">
                        {km != null && km <= 1.5 ? (
                          <>
                            <strong>Walkable</strong>, about {Math.round(km * 10) / 10} km to college
                          </>
                        ) : (
                          <>
                            <strong>{mins} min</strong> to college by bus or metro
                            {km != null && <span className="muted">, about {Math.round(km * 10) / 10} km</span>}
                          </>
                        )}
                      </p>
                      <button
                        type="button"
                        className="btn btn-quiet small-btn"
                        onClick={() => setPickedPg(pg.id)}
                        aria-pressed={chosen?.pg.id === pg.id}
                      >
                        {chosen?.pg.id === pg.id ? 'Used in cost estimate' : 'Use in cost estimate'}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <aside className="move-side">
              {cost && (
                <div className="plan-summary cost-card" aria-live="polite">
                  <p className="muted small">A month here costs about</p>
                  <p className="plan-total">{rupees(cost.total)}</p>
                  <dl className="cost-rows">
                    {cost.rows.map(([label, value, note]) => (
                      <div key={label}>
                        <dt>
                          {label}
                          <span>{note}</span>
                        </dt>
                        <dd>{rupees(value)}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="cost-edit">
                    <label>
                      <span>Phone and internet</span>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={extras.phone}
                        onChange={(e) => setExtras({ ...extras, phone: Math.max(0, Number(e.target.value)) })}
                      />
                    </label>
                    <label>
                      <span>Everything else</span>
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={extras.misc}
                        onChange={(e) => setExtras({ ...extras, misc: Math.max(0, Number(e.target.value)) })}
                      />
                    </label>
                  </div>
                  <p className="muted small">
                    An estimate from listed rents and prices (food prices are approximate). Your college fees aren't
                    included.
                  </p>
                </div>
              )}

              <section className="tool-card" aria-labelledby="food-title">
                <h2 id="food-title">Cheap food nearby</h2>
                <ul className="mini-list">
                  {nearby.food.map((f) => (
                    <li key={f.id}>
                      <Link to={placeUrl('food', f)}>{f.name}</Link>
                      <span className="muted small">
                        {f.cuisine}, {rupees(f.costForTwo)} for two, {f.area}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="tool-card" aria-labelledby="gym-title">
                <h2 id="gym-title">Gyms nearby</h2>
                <ul className="mini-list">
                  {nearby.gyms.map((g) => (
                    <li key={g.id}>
                      <Link to={placeUrl('gyms', g)}>{g.name}</Link>
                      <span className="muted small">
                        {price(g.monthlyFee, '/mo', 'fee not published')}, {g.area}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>

          <section className="detail-section" aria-labelledby="move-map">
            <h2 id="move-map">On the map</h2>
            <Suspense fallback={<div className="map-placeholder" style={{ height: 420 }} />}>
              <MapView points={points} showMetro height={420} label={`Map around ${college.name}`} />
            </Suspense>
          </section>
        </>
      )}
    </div>
  )
}
