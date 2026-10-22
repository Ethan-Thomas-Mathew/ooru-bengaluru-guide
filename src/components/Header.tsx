// Top bar shown on every page: logo, main links, rain mode switch,
// and a row of category links underneath
import { useEffect, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { SITE } from '../site'
import { CATEGORIES } from '../data/categories'
import { useSaved } from '../lib/saved'
import { usePlan } from '../lib/plan'
import { setRainMode, useRainMode } from '../lib/prefs'

export default function Header() {
  const saved = useSaved() // so the count updates as you save things
  const plan = usePlan()
  const rain = useRainMode()

  // On phones the category row scrolls sideways. When the page changes,
  // slide the row so the highlighted category is in the middle.
  const catRow = useRef<HTMLUListElement>(null)
  const { pathname } = useLocation()
  useEffect(() => {
    const row = catRow.current
    const active = row?.querySelector<HTMLElement>('a.active')
    if (!row || !active) return
    row.scrollTo({ left: active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' })
  }, [pathname])

  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link to="/" className="logo" aria-label={`${SITE.name} home`}>
          {/* Small mark: purple + green metro lines crossing at Majestic */}
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
            <path
              d="M6 22 L13 15 L26 15"
              stroke="var(--purple)"
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 5 L19 14 L19 27"
              stroke="var(--green)"
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="18" cy="15" r="3.5" fill="#fff" stroke="var(--ink)" strokeWidth="2" />
          </svg>
          <span>{SITE.name}</span>
        </Link>

        <nav aria-label="Main">
          <ul className="nav-links">
            <li>
              <NavLink to="/move-in">Move-in kit</NavLink>
            </li>
            <li>
              <NavLink to="/plan">
                Day planner{plan.stops.length > 0 && <span className="badge">{plan.stops.length}</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/getting-around">Bus and metro</NavLink>
            </li>
            <li>
              <NavLink to="/newcomer">Newcomers</NavLink>
            </li>
            <li>
              <NavLink to="/saved">Saved{saved.length > 0 && <span className="badge">{saved.length}</span>}</NavLink>
            </li>
            <li>
              {/* Rain mode: adds rain delays and flags outdoor places + flood spots */}
              <button
                type="button"
                className={`rain-toggle${rain ? ' is-on' : ''}`}
                aria-pressed={rain}
                onClick={() => setRainMode(!rain)}
                title="Rain mode: adds rain delays and warns about outdoor places and waterlogging"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M3 12a9 9 0 0 1 18 0z"
                    fill={rain ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 12v6.5a2 2 0 0 1-4 0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <span>{rain ? 'Rain mode on' : 'Rain mode'}</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {/* Second row: one link per category (Colleges, PGs, Food, Places ...).
          Same order as the home page. Scrolls sideways on small screens. */}
      <nav aria-label="Categories" className="cat-bar">
        <ul className="wrap cat-links" ref={catRow}>
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <NavLink to={`/explore/${c.id}`}>{c.short ?? c.name}</NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {rain && (
        <div className="rain-banner" role="status">
          <div className="wrap">
            Rain mode is on: travel times include rain delays, and outdoor places and waterlogging spots are flagged.
          </div>
        </div>
      )}
    </header>
  )
}
