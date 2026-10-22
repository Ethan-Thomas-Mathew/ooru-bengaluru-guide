// ---------------------------------------------------------------
// Home.jsx
// 1. Hero: search box + animated metro map
// 2. What's happening: the next few events, by date
// 3. Explore: every category, grouped
// ---------------------------------------------------------------

import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { riseHeadline } from '../lib/motion'
import SearchBar from '../components/SearchBar'
import MetroMap from '../components/MetroMap'
import type { EventItem } from '../../shared/types'
import { CATEGORIES, GROUPS, mustCategory } from '../data/categories'
import { useData } from '../lib/dataContext'
import { usePageTitle } from '../lib/usePageTitle'
import { applyFilters, emptyFilters } from '../lib/filters'

// Quick searches shown under the box
const TRY = [
  'Plan my day',
  'PG near metro under 10000',
  'Engineering colleges',
  'Pure veg dosa in Malleshwaram',
  'Metro from Kengeri to Electronic City',
  'Auto fare calculator',
]

function UpcomingEvents() {
  const events = mustCategory('events')
  useData() // re-render when fresh data arrives
  // Reuse the same filter code as the results page (it hides past events)
  const upcoming = applyFilters(events, emptyFilters(events), 'date').slice(0, 5) as EventItem[]

  return (
    <section className="section" aria-labelledby="events-title">
      <div className="section-head">
        <h2 id="events-title">Coming up in Bengaluru</h2>
        <Link to="/explore/events" className="text-link">
          See all events
        </Link>
      </div>
      <ol className="event-list">
        {upcoming.map((e) => {
          const d = e.date ? new Date(e.date + 'T00:00:00') : null
          return (
            <li key={e.id} className="event-row">
              <div className="event-date" aria-hidden="true">
                {d ? (
                  <>
                    <span className="event-day">{d.getDate()}</span>
                    <span className="event-month">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                  </>
                ) : (
                  <span className="event-month">TBA</span>
                )}
              </div>
              <div className="event-body">
                <h3>{e.name}</h3>
                <p className="muted">
                  {/* Screen readers get the full date here */}
                  <span className="sr-only">{d ? d.toDateString() : e.dateLabel}. </span>
                  {e.kind} at {e.venue}
                  {e.distances.length > 0 && <>, {e.distances.join(' / ')}</>}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Explore() {
  return (
    <section className="section" id="explore" aria-labelledby="explore-title">
      <div className="section-head">
        <h2 id="explore-title">Browse the city</h2>
      </div>
      <div className="explore-grid">
        {GROUPS.map((group) => (
          <div key={group.id} className="explore-group">
            <h3>{group.title}</h3>
            <ul>
              {CATEGORIES.filter((c) => c.group === group.id).map((c) => (
                <li key={c.id}>
                  <Link to={`/explore/${c.id}`}>
                    <span className="explore-name">{c.name}</span>
                    <span className="explore-count">{c.data.length}</span>
                  </Link>
                  <p className="muted small">{c.blurb}</p>
                </li>
              ))}
              {/* Bus and metro is its own page, not a list category */}
              {group.id === 'Study' && (
                <li>
                  <Link to="/move-in">
                    <span className="explore-name">Move-in kit</span>
                  </Link>
                  <p className="muted small">PGs by commute and a monthly cost estimate for your college</p>
                </li>
              )}
              {group.id === 'Move' && (
                <>
                  <li>
                    <Link to="/getting-around">
                      <span className="explore-name">Bus and metro routes</span>
                    </Link>
                    <p className="muted small">Plan a trip from A to B, with metro fares</p>
                  </li>
                  <li>
                    <Link to="/newcomer">
                      <span className="explore-name">Newcomer pack</span>
                    </Link>
                    <p className="muted small">Auto fares, metro fares and pocket Kannada</p>
                  </li>
                </>
              )}
              {group.id === 'See' && (
                <li>
                  <Link to="/plan">
                    <span className="explore-name">Day planner</span>
                  </Link>
                  <p className="muted small">Pick places, see how long the day takes</p>
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Home() {
  const titleRef = useRef<HTMLHeadingElement>(null)
  usePageTitle()
  // Letters of the headline rise in; the returned function undoes the split
  useEffect(() => riseHeadline(titleRef.current), [])

  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <div className="hero-copy">
            <h1 ref={titleRef}>Find anything in Bengaluru</h1>
            <p className="hero-lede">
              Colleges, PGs near campus, gyms, darshinis, rentals, and how to get there by bus or metro. Type it the way
              you'd ask a friend.
            </p>
            <SearchBar size="large" />
            <div className="try">
              <span className="muted small">Try</span>
              <ul>
                {TRY.map((t) => (
                  <li key={t}>
                    <Link className="chip" to={`/search?q=${encodeURIComponent(t)}`}>
                      {t}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <MetroMap />
        </div>
      </section>

      <div className="wrap">
        <UpcomingEvents />
        <Explore />
      </div>
    </>
  )
}
