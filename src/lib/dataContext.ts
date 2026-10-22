// The shared "data" context. DataProvider (dataStore.tsx) fills it in;
// any component calls useData() to read it and re-render on changes.
import { createContext, useContext } from 'react'
import type { ReviewSummary } from '../../shared/types'

export interface DataState {
  /** Goes up by 1 every time data changes (use it in useMemo deps) */
  version: number
  /** Community ratings from reviews, by listing key */
  reviews: ReviewSummary
  /** 'live' = server data, 'bundled' = built-in copy */
  source: 'bundled' | 'live'
  /** Ask the server again (after the admin adds a listing, for example) */
  refresh: () => Promise<void>
}

export const DataContext = createContext<DataState>({
  version: 0,
  reviews: {},
  source: 'bundled',
  refresh: async () => {},
})

export const useData = () => useContext(DataContext)
