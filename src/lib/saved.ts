// ---------------------------------------------------------------
// saved.ts
// The "Saved" shortlist: a list of keys like "colleges:c-christ"
// (category id + item id), kept in the browser.
// ---------------------------------------------------------------

import { readStored, useStored, writeStored } from './storage'

const KEY = 'ooru-saved'

export const makeKey = (categoryId: string, itemId: string) => `${categoryId}:${itemId}`

export function toggleSaved(key: string): void {
  const list = readStored<string[]>(KEY, [])
  writeStored(KEY, list.includes(key) ? list.filter((k) => k !== key) : [...list, key])
}

export const useSaved = () => useStored<string[]>(KEY, [])
