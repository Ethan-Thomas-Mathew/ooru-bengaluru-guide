// ---------------------------------------------------------------
// CookieBanner.jsx
// Asks for cookie consent the first time someone visits.
// The choice is saved in the browser (localStorage) so we don't ask again.
// ---------------------------------------------------------------

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { slideUp } from '../lib/motion'

const STORAGE_KEY = 'ooru-cookie-consent'

// localStorage can throw in private browsing, so we wrap it in try/catch
function readConsent() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
function saveConsent(value: 'essential' | 'all') {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* ignore: banner will just show again next visit */
  }
}

export default function CookieBanner() {
  // Show the banner only if no choice has been saved yet
  const [open, setOpen] = useState(() => readConsent() === null)
  const boxRef = useRef<HTMLDivElement>(null)

  // Animate in whenever it opens
  useEffect(() => {
    if (open) slideUp(boxRef.current)
  }, [open])

  // The footer's "Cookie settings" button fires this event
  useEffect(() => {
    const reopen = () => setOpen(true)
    window.addEventListener('open-cookie-settings', reopen)
    return () => window.removeEventListener('open-cookie-settings', reopen)
  }, [])

  const choose = (value: 'essential' | 'all') => {
    saveConsent(value)
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="cookie-banner" ref={boxRef} role="dialog" aria-live="polite" aria-label="Cookie consent">
      <p>
        We use essential storage to remember your settings. With your OK we'd also like to count visits so we know which
        guides people use. <Link to="/cookies">Read the cookie policy</Link>
      </p>
      <div className="cookie-actions">
        <button type="button" className="btn btn-quiet" onClick={() => choose('essential')}>
          Essential only
        </button>
        <button type="button" className="btn btn-primary" onClick={() => choose('all')}>
          Accept all
        </button>
      </div>
    </div>
  )
}
