// ---------------------------------------------------------------
// Results.tsx
// Handles two kinds of URLs:
//   /search?q=bca colleges in jayanagar   (typed search)
//   /explore/colleges                      (clicked a category)
// Shows a filterable list, or the same results on a map.
// ---------------------------------------------------------------

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import SearchBar from '../components/SearchBar'
import FilterPanel from '../components/FilterPanel'
import ResultCard from '../components/ResultCard'
import { getCategory, type Category } from '../data/categories'
import { parseQuery, searchEverything, relevance, type ParsedQuery } from '../lib/search'
import { applyFilters, emptyFilters, countActive, type FilterState } from '../lib/filters'
import { revealList, useFlip } from '../lib/motion'
import { useData } from '../lib/dataContext'
import { usePageTitle } from '../lib/usePageTitle'
import { toPoints } from '../lib/mapPoints'

// The map is only downloaded if someone switches to map view
const MapView = lazy(() => import('../components/MapView'))

// ---- Results for ONE category, with filters on the side ----------
interface CategoryResultsProps {
  category: Category
  initialFilters: FilterState
  initialSort: string
  words: string[]
}

function CategoryResults({ category, initialFilters, initialSort, words }: CategoryResultsProps) {
  const [filters, setFilters] = useState(initialFilters)
  const [sort, setSort] = useState(initialSort)
  const [view, setView] = useState<'list' | 'map'>('list')
  // Filters start open on wide screens, closed on phones (so results show first)
  const [filtersOpen, setFiltersOpen] = useState(() => window.innerWidth >= 900)
  const { version } = useData()

  // useMemo: only recalculate when filters, sort, words or data change
  const items = useMemo(() => {
    const list = applyFilters(category, filters, sort)
    if (!words.length) return list
    // Leftover words like "christ" in "christ university": best name
    // matches first. JS sort is "stable", so ties keep the chosen sort.
    return [...list].sort((a, b) => relevance(b, words) - relevance(a, words))
    // version: re-run when fresh data arrives from the server
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, filters, sort, words, version])
  const points = useMemo(() => toPoints(category.id, items), [category.id, items])
  const active = countActive(category, filters)

  // First load: cards rise in. After that, cards glide to new spots (FLIP).
  const { ref: listRef, record } = useFlip('.result-card', [items])
  useEffect(() => {
    revealList('.result-card')
  }, [])

  // Remember card positions, THEN change state, so useFlip can animate
  const changeFilters = (next: FilterState) => {
    record()
    setFilters(next)
  }
  const changeSort = (next: string) => {
    record()
    setSort(next)
  }
  const clear = () => changeFilters(emptyFilters(category))

  return (
    <div className="results-layout">
      <aside className="results-side" aria-label="Filters">
        {/* <details> makes filters collapsible on small screens */}
        <details className="filter-box" open={filtersOpen} onToggle={(e) => setFiltersOpen(e.currentTarget.open)}>
          <summary>Filters{active > 0 && <span className="badge">{active}</span>}</summary>
          <FilterPanel category={category} filters={filters} onChange={changeFilters} />
          {active > 0 && (
            <button type="button" className="btn btn-quiet full" onClick={clear}>
              Clear filters
            </button>
          )}
        </details>
      </aside>

      <section className="results-main" aria-labelledby="results-title">
        <div className="results-bar">
          <div>
            <h1 id="results-title">{category.name}</h1>
            <p className="muted" aria-live="polite">
              {items.length} {items.length === 1 ? 'result' : 'results'}
            </p>
          </div>
          <div className="results-tools">
            <div className="view-toggle" role="radiogroup" aria-label="Show as">
              <button type="button" role="radio" aria-checked={view === 'list'} onClick={() => setView('list')}>
                List
              </button>
              <button type="button" role="radio" aria-checked={view === 'map'} onClick={() => setView('map')}>
                Map
              </button>
            </div>
            <label className="sort">
              <span>Sort by</span>
              <select value={sort} onChange={(e) => changeSort(e.target.value)}>
                {category.sorts.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="empty">
            <h2>Nothing matches all of these filters</h2>
            <p className="muted">Untick an area or raise the price limit to see more.</p>
            <button type="button" className="btn btn-primary" onClick={clear}>
              Clear filters
            </button>
          </div>
        ) : view === 'map' ? (
          <Suspense fallback={<div className="map-placeholder" style={{ height: 520 }} />}>
            <MapView points={points} showMetro height={520} label={`Map of ${category.name.toLowerCase()}`} />
          </Suspense>
        ) : (
          <ul className="result-list" ref={listRef}>
            {items.map((item) => (
              <ResultCard key={item.id} item={item} category={category} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ---- Results across ALL categories (no category was detected) ----
function EverythingResults({ words }: { words: string[] }) {
  const { version } = useData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => searchEverything(words), [words, version])

  useEffect(() => {
    revealList('.result-card')
  }, [words])

  if (!groups.length) {
    return (
      <div className="empty">
        <h1>No matches for "{words.join(' ')}"</h1>
        <p className="muted">Try a type of place with an area, like "gyms in Jayanagar" or "PG near Jain".</p>
        <Link className="btn btn-primary" to="/#explore">
          Browse all categories
        </Link>
      </div>
    )
  }
  return (
    <div className="everything">
      <h1>Results for "{words.join(' ')}"</h1>
      {groups.map(({ category, items }) => (
        <section key={category.id} className="everything-group">
          <div className="section-head">
            <h2>{category.name}</h2>
            <Link className="text-link" to={`/explore/${category.id}`}>
              All {category.name.toLowerCase()}
            </Link>
          </div>
          <ul className="result-list">
            {items.slice(0, 4).map((item) => (
              <ResultCard key={item.id} item={item} category={category} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

// ---- The page itself ---------------------------------------------
export default function Results() {
  const { categoryId } = useParams()
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''

  // Work out what to show
  let parsed: ParsedQuery
  const fromUrl = categoryId ? getCategory(categoryId) : null
  if (categoryId && fromUrl) {
    parsed = {
      type: 'category',
      categoryId: fromUrl.id,
      filters: emptyFilters(fromUrl),
      sort: fromUrl.sorts[0].key,
      words: [],
      corrected: null,
    }
  } else {
    parsed = parseQuery(q)
  }
  // Words as one string, so the memo below only changes when the words do
  const wordsKey = parsed.type === 'category' || parsed.type === 'all' ? parsed.words.join(' ') : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const words = useMemo(() => (wordsKey ? wordsKey.split(' ') : []), [wordsKey])

  const title = parsed.type === 'category' ? getCategory(parsed.categoryId)?.name : q ? `Search: ${q}` : 'Search'
  usePageTitle(title)

  if (categoryId && !fromUrl) return <Navigate to="/" replace />
  // "plan my day", "auto fare" ... -> that tool's page
  if (parsed.type === 'page') return <Navigate to={parsed.path} replace />
  // "metro from A to B" -> the route planner page
  if (parsed.type === 'transit') {
    const to = new URLSearchParams({ mode: parsed.mode, from: parsed.from, to: parsed.to })
    return <Navigate to={`/getting-around?${to}`} replace />
  }

  return (
    <div className="wrap page">
      <div className="results-search">
        {/* key={q}: a new search resets the box to the new text */}
        <SearchBar key={q} size="small" initial={q} />
        {parsed.corrected && (
          <p className="notice small">
            Showing results for <strong>{parsed.corrected}</strong>. We fixed a typo in "{q}".
          </p>
        )}
      </div>
      {parsed.type === 'category' ? (
        // `key` makes React start fresh (new filter state) when the search changes
        <CategoryResults
          key={(categoryId ?? '') + q}
          category={getCategory(parsed.categoryId)!}
          initialFilters={parsed.filters}
          initialSort={parsed.sort}
          words={words}
        />
      ) : (
        <EverythingResults words={words} />
      )}
    </div>
  )
}
