// ---------------------------------------------------------------
// Newcomer.tsx  (/newcomer)
// A survival pack for people new to Bengaluru:
//   - auto fare estimator (meter rates from August 2025)
//   - metro fare + time between any two stations
//   - a pocket Kannada phrasebook (with "listen" if the device has a Kannada voice)
// ---------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import { AREA_NAMES, areaCoords, distanceKm, ROAD_FACTOR } from '../lib/geo'
import { AUTO, autoFare, metroFare } from '../lib/fares'
import { ALL_STATIONS, findMetroRoute } from '../lib/transit'
import { PHRASE_GROUPS } from '../data/phrases'
import { usePageTitle } from '../lib/usePageTitle'

const AREAS = AREA_NAMES.filter((a) => a !== 'Bengaluru')

// ---- Auto fare ------------------------------------------------------
function AutoFare() {
  const [from, setFrom] = useState('Majestic')
  const [to, setTo] = useState('Koramangala')
  const [night, setNight] = useState(false)

  const a = areaCoords(from)
  const b = areaCoords(to)
  const km = a && b ? Math.max(1, Math.round(distanceKm(a, b) * ROAD_FACTOR * 10) / 10) : 0
  const fare = autoFare(km, night)

  return (
    <section className="tool-card" aria-labelledby="auto-title">
      <h2 id="auto-title">Auto fare</h2>
      <div className="tool-fields">
        <label className="field">
          <span>From</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            {AREAS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>To</span>
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            {AREAS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} />
          <span>Night (10 PM to 5 AM)</span>
        </label>
      </div>
      <p className="tool-result" aria-live="polite">
        <strong>₹{fare}</strong>
        <span>for about {km} km by road</span>
      </p>
      <p className="muted small">
        Meter rate: ₹{AUTO.baseFare} for the first {AUTO.baseKm} km, then ₹{AUTO.perKm} per km. Night rides cost 1.5
        times the normal fare. Waiting and luggage charges are extra. Ask the driver to put the meter on (see "Meter
        haaki" below).
      </p>
    </section>
  )
}

// ---- Metro fare -------------------------------------------------------
function MetroFare() {
  const [from, setFrom] = useState('Majestic')
  const [to, setTo] = useState('Indiranagar')
  const route = useMemo(() => findMetroRoute(from, to), [from, to])

  return (
    <section className="tool-card" aria-labelledby="metro-title">
      <h2 id="metro-title">Metro fare</h2>
      <div className="tool-fields">
        <label className="field">
          <span>From</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            {ALL_STATIONS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>To</span>
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            {ALL_STATIONS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      {route && route.stops > 0 ? (
        <p className="tool-result" aria-live="polite">
          <strong>₹{metroFare(route.km)}</strong>
          <span>
            token, or ₹{metroFare(route.km, true)} with a smart card. About {route.minutes} min, {route.stops} stops
            {route.changes > 0 && `, ${route.changes} change${route.changes > 1 ? 's' : ''}`}.
          </span>
        </p>
      ) : (
        <p className="tool-result muted">Pick two different stations.</p>
      )}
      <p className="muted small">
        Fares from ₹10 to ₹90 by distance (February 2025 fare chart). Smart cards get 5% off. Distance here is measured
        between stations, so the fare can differ by one slab.
      </p>
    </section>
  )
}

// ---- Phrasebook -------------------------------------------------------
function Phrasebook() {
  // Only show "Listen" if the device has a Kannada voice installed
  const [canSpeak, setCanSpeak] = useState(false)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const check = () => setCanSpeak(speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith('kn')))
    check()
    speechSynthesis.addEventListener('voiceschanged', check)
    return () => speechSynthesis.removeEventListener('voiceschanged', check)
  }, [])

  const speak = (text: string) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'kn-IN'
    u.rate = 0.85
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
  }

  return (
    <section className="phrasebook" aria-labelledby="phrases-title">
      <h2 id="phrases-title">Pocket Kannada</h2>
      <p className="muted">People appreciate even a word or two. Say each phrase the way the bold line spells it.</p>
      <div className="phrase-groups">
        {PHRASE_GROUPS.map((g) => (
          <div key={g.title} className="phrase-group">
            <h3>{g.title}</h3>
            <ul>
              {g.phrases.map((p) => (
                <li key={p.say}>
                  <span className="kn" lang="kn">
                    {p.kannada}
                  </span>
                  <span className="say">{p.say}</span>
                  <span className="meaning">{p.meaning}</span>
                  {canSpeak && (
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => speak(p.kannada)}
                      aria-label={`Listen: ${p.say}`}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
                        <path
                          d="M16 8.5a5 5 0 0 1 0 7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Newcomer() {
  usePageTitle('Newcomer pack')
  return (
    <div className="wrap page newcomer">
      <h1>New to Bengaluru?</h1>
      <p className="muted lede-small">
        Check what an auto or metro ride should cost before you get in, and learn a few words of Kannada.
      </p>
      <div className="tool-grid">
        <AutoFare />
        <MetroFare />
      </div>
      <section className="tips" aria-labelledby="tips-title">
        <h2 id="tips-title">Good to know</h2>
        <ul>
          <li>Rush hour is roughly 8 to 11 AM and 5 to 9 PM. The day planner adds this delay for you.</li>
          <li>
            Heavy rain is common from June to November. Turn on rain mode (top right) to flag outdoor places and spots
            that flood.
          </li>
          <li>The metro is usually the fastest way along its lines, especially at rush hour.</li>
          <li>Keep some cash or UPI ready for autos, and check the meter is running at the start.</li>
        </ul>
      </section>
      <Phrasebook />
    </div>
  )
}
