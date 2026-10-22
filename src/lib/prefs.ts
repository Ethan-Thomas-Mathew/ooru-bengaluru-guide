// ---------------------------------------------------------------
// prefs.ts
// Site-wide settings the visitor can switch: rain mode.
// Rain mode adds rain delays to travel times, warns about outdoor
// places and spots that flood, and suggests indoor alternatives.
// ---------------------------------------------------------------

import { readStored, useStored, writeStored } from './storage'

const RAIN_KEY = 'ooru-rain'

export const useRainMode = () => useStored<boolean>(RAIN_KEY, false)
export const setRainMode = (on: boolean) => writeStored(RAIN_KEY, on)
export const isRainMode = () => readStored<boolean>(RAIN_KEY, false)

/** June to November is roughly monsoon + retreating monsoon in Bengaluru */
export const isRainySeason = (date = new Date()) => date.getMonth() >= 5 && date.getMonth() <= 10
