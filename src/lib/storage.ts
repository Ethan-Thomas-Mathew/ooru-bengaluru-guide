// ---------------------------------------------------------------
// storage.ts
// One small helper for "remember this in the browser" values
// (saved list, day plan, rain mode). localStorage can throw in private
// browsing, so every read/write is wrapped in try/catch.
//
// useStored(key, fallback) works like useState, but:
//   - the value survives a page reload
//   - every component using the same key updates together
// ---------------------------------------------------------------

import { useEffect, useState } from 'react'

const EVENT = 'ooru-storage'

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked: the value lasts until the tab closes */
  }
  // Tell every useStored(key) on the page to re-read
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }))
}

export function useStored<T>(key: string, fallback: T): T {
  const [value, setValue] = useState<T>(() => readStored(key, fallback))
  useEffect(() => {
    const update = (e: Event) => {
      // Our own event says which key changed; the browser's 'storage'
      // event fires when ANOTHER tab changes something
      const changedKey = e instanceof CustomEvent ? e.detail : (e as StorageEvent).key
      if (changedKey === key) setValue(readStored(key, fallback))
    }
    window.addEventListener(EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(EVENT, update)
      window.removeEventListener('storage', update)
    }
    // fallback is a constant default; re-subscribing on every render isn't needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return value
}
