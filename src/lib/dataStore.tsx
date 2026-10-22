// ---------------------------------------------------------------
// dataStore.tsx
// Where the listings come from.
//
// 1. The site starts instantly with the data bundled in src/data/*.json.
// 2. Then it asks the server for the latest listings + review ratings.
// 3. If the server answers, we swap in its data and re-render.
//    If not (offline, server not running), the bundled data stays.
//
// Components call useData() to re-render when the data changes.
// ---------------------------------------------------------------

import { useEffect, useState, type ReactNode } from 'react'
import type { ReviewSummary } from '../../shared/types'
import { CATEGORIES } from '../data/categories'
import { enrichAll } from './enrich'
import { resetSearchIndex } from './search'
import { api } from './api'
import { DataContext } from './dataContext'

// Enrich the bundled data straight away (runs once when this file loads)
enrichAll()

export function DataProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0)
  const [reviews, setReviews] = useState<ReviewSummary>({})
  const [source, setSource] = useState<'bundled' | 'live'>('bundled')

  const refresh = async () => {
    try {
      // Ask for both at the same time
      const [listings, summary] = await Promise.all([api.listings(), api.reviewSummary()])
      for (const cat of CATEGORIES) {
        if (listings[cat.id]?.length) cat.data = listings[cat.id]
      }
      // Ratings come only from reviews. Copy each average onto its listing
      // so the rating filter and "sort by rating" can use it.
      for (const cat of CATEGORIES) {
        for (const item of cat.data) item.rating = summary[`${cat.id}:${item.id}`]?.average
      }
      enrichAll()
      resetSearchIndex() // new names -> rebuild the typo-fixing word list
      setReviews(summary)
      setSource('live')
      setVersion((v) => v + 1)
    } catch {
      // Server not reachable: keep the bundled data. Nothing else to do.
    }
  }

  useEffect(() => {
    // `refresh` updates state after the fetch finishes, never during render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    void refresh()
  }, [])

  return <DataContext.Provider value={{ version, reviews, source, refresh }}>{children}</DataContext.Provider>
}
