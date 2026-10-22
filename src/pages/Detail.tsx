// ---------------------------------------------------------------
// Detail.tsx   (/place/:categoryId/:id)
// The full page for one listing, plus related things:
//   - a map, the nearest metro station, reviews
//   - PGs near a college (and the college a PG is near)
//   - in rain mode: indoor places nearby instead of outdoor ones
//   - similar listings, and other listings in the same area
// ---------------------------------------------------------------

import { lazy, Suspense, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { BaseItem, Pg, Place } from '../../shared/types'
import { CATEGORIES, field, getCategory, mustCategory, metroText, type Category } from '../data/categories'
import ResultCard from '../components/ResultCard'
import Rating from '../components/Rating'
import SaveButton from '../components/SaveButton'
import PlanButton from '../components/PlanButton'
import Reviews from '../components/Reviews'
import { placeUrl } from '../lib/urls'
import { toPoints } from '../lib/mapPoints'
import { coordsFor, distanceKm } from '../lib/geo'
import { useRainMode } from '../lib/prefs'
import { OUTDOOR_KINDS, FLOOD_AREAS, floodSpot } from '../lib/traffic'
import { useData } from '../lib/dataContext'
import { usePageTitle } from '../lib/usePageTitle'
import NotFound from './NotFound'

const MapView = lazy(() => import('../components/MapView'))

// Google Maps search link. No API key needed: it just opens Maps.
// With a street address, Maps finds the exact building.
const mapsUrl = (item: BaseItem & { venue?: string }) =>
  'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent(`${item.venue ?? item.name}, ${item.address ?? item.area}, Bengaluru`)

// "https://www.stanzaliving.com/bengaluru/..." -> "stanzaliving.com"
const siteName = (url: string) => new URL(url).hostname.replace(/^www\./, '')

// Where this listing's facts came from, in one sentence
function sourceNote(item: BaseItem, categoryId: string) {
  const parts: string[] = []
  if (categoryId === 'colleges' && field(item, 'nirf')) parts.push('NIRF rank from the official NIRF 2025 list.')
  if (categoryId === 'colleges' || categoryId === 'schools') parts.push('Fees are rough and vary by course and year.')
  if (categoryId === 'food') parts.push('Cost for two is approximate.')
  parts.push('Prices change, so confirm with the place before you pay.')
  return parts.join(' ')
}

// Everything in OTHER categories that is in the same area
function sameArea(item: BaseItem, category: Category) {
  if (!item.area || item.area === 'Bengaluru') return []
  return CATEGORIES.filter((c) => c.id !== category.id).flatMap((c) =>
    c.data.filter((other) => other.area === item.area).map((other) => ({ category: c, item: other })),
  )
}

// Same category, sharing one field. A category can choose the field with
// `similarBy`; otherwise we use its first checkbox filter.
function similar(item: BaseItem, category: Category) {
  const key = category.similarBy ?? category.filters.find((x) => x.type === 'multi')?.field
  if (!key) return []
  const value = field(item, key)
  const values = Array.isArray(value) ? value : [value]
  return category.data
    .filter((other) => other.id !== item.id)
    .filter((other) => {
      const v = field(other, key)
      return (Array.isArray(v) ? v : [v]).some((x) => values.includes(x))
    })
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 3)
}

// Rain mode: indoor places closest to this one
function indoorNearby(item: BaseItem) {
  const here = coordsFor(item)
  if (!here) return []
  return (mustCategory('places').data as Place[])
    .filter((p) => !OUTDOOR_KINDS.has(p.kind) && p.id !== item.id)
    .map((p) => ({ p, km: coordsFor(p) ? distanceKm(here, coordsFor(p)!) : 99 }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 3)
}

export default function Detail() {
  const { categoryId = '', id } = useParams()
  const category = getCategory(categoryId)
  const item = category?.data.find((x) => x.id === id)
  const rain = useRainMode()
  const { version } = useData()
  usePageTitle(item?.name)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const points = useMemo(() => (item && category ? toPoints(category.id, [item]) : []), [item, category, version])
  if (!category || !item) return <NotFound />

  const info = category.describe(item)
  const nearby = sameArea(item, category).slice(0, 6)
  const alike = similar(item, category)
  const kind = (item as Place).kind
  const isOutdoor = category.id === 'places' && OUTDOOR_KINDS.has(kind)

  // Cross-links between colleges and PGs
  const pgs = mustCategory('pgs')
  const pgsNear = category.id === 'colleges' ? (pgs.data as Pg[]).filter((p) => p.collegeId === item.id) : []
  const pg = item as Pg
  const college =
    category.id === 'pgs' && pg.collegeId ? mustCategory('colleges').data.find((c) => c.id === pg.collegeId) : null

  return (
    <div className="wrap page detail">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/explore/${category.id}`}>{category.name}</Link>
      </nav>

      <header className="detail-head">
        <div>
          <h1>{item.name}</h1>
          <p className="detail-sub">{info.subtitle}</p>
        </div>
        <div className="detail-actions">
          <Rating item={item} categoryId={category.id} />
          <SaveButton categoryId={category.id} item={item} withLabel />
          <PlanButton categoryId={category.id} item={item} withLabel />
          <a className="btn btn-quiet" href={mapsUrl(item)} target="_blank" rel="noopener noreferrer">
            Open in Google Maps
          </a>
        </div>
      </header>

      {rain && (isOutdoor || FLOOD_AREAS.has(item.area)) && (
        <div className="notice rain-notice">
          {isOutdoor && (
            <p>
              <strong>Rain mode:</strong> this is mostly outdoors.
            </p>
          )}
          {FLOOD_AREAS.has(item.area) && (
            <p>Waterlogging has been reported nearby after heavy rain: {floodSpot(item.area)}.</p>
          )}
        </div>
      )}

      <div className="detail-grid">
        <div>
          <dl className="detail-facts">
            {info.facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            {item.priceNote && (
              <div>
                <dt>Price details</dt>
                <dd>{item.priceNote}</dd>
              </div>
            )}
            {item.address && (
              <div>
                <dt>Address</dt>
                <dd>{item.address}</dd>
              </div>
            )}
            {category.id !== 'events' && (
              <div>
                <dt>Nearest metro</dt>
                <dd>{metroText(item)}</dd>
              </div>
            )}
            {college && (
              <div>
                <dt>Near</dt>
                <dd>
                  <Link to={placeUrl('colleges', college)}>{college.name}</Link>
                </dd>
              </div>
            )}
          </dl>

          {info.tags.length > 0 && (
            <ul className="tags detail-tags" aria-label="Details">
              {info.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}

          {category.id === 'colleges' && (
            <p>
              <Link className="btn btn-primary" to={`/move-in/${item.id}`}>
                Open the move-in kit for this college
              </Link>
            </p>
          )}

          <p className="muted small source-note">
            {item.source && (
              <>
                Source:{' '}
                <a href={item.source} target="_blank" rel="noopener noreferrer">
                  {siteName(item.source)}
                </a>
                {item.checked &&
                  `, checked ${new Date(item.checked + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                .{' '}
              </>
            )}
            {sourceNote(item, category.id)}
          </p>
        </div>

        {points.length > 0 && (
          <Suspense fallback={<div className="map-placeholder" style={{ height: 300 }} />}>
            <MapView points={points} showMetro height={300} label={`Map showing ${item.name}`} />
          </Suspense>
        )}
      </div>

      {rain && isOutdoor && (
        <section className="detail-section" aria-labelledby="indoor">
          <h2 id="indoor">Indoor places nearby</h2>
          <ul className="nearby-list">
            {indoorNearby(item).map(({ p, km }) => (
              <li key={p.id}>
                <Link to={placeUrl('places', p)}>{p.name}</Link>
                <span className="muted small">
                  {p.kind}, about {Math.max(1, Math.round(km))} km away
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pgsNear.length > 0 && (
        <section className="detail-section" aria-labelledby="pgs-near">
          <h2 id="pgs-near">PGs near {item.name}</h2>
          <ul className="result-list">
            {pgsNear.map((p) => (
              <ResultCard key={p.id} item={p} category={pgs} />
            ))}
          </ul>
        </section>
      )}

      <Reviews listingKey={`${category.id}:${item.id}`} name={item.name} />

      {alike.length > 0 && (
        <section className="detail-section" aria-labelledby="similar">
          <h2 id="similar">Similar {category.name.toLowerCase()}</h2>
          <ul className="result-list">
            {alike.map((x) => (
              <ResultCard key={x.id} item={x} category={category} />
            ))}
          </ul>
        </section>
      )}

      {nearby.length > 0 && (
        <section className="detail-section" aria-labelledby="nearby">
          <h2 id="nearby">Also in {item.area}</h2>
          <ul className="nearby-list">
            {nearby.map(({ category: c, item: x }) => (
              <li key={c.id + x.id}>
                <Link to={placeUrl(c.id, x)}>{x.name}</Link>
                <span className="muted small">{c.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
