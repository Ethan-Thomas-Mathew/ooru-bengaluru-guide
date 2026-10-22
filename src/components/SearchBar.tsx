// ---------------------------------------------------------------
// SearchBar.jsx
// The big search box. Three extras:
//  1. When empty, it cycles through example searches (scramble effect).
//  2. While typing, it shows what it understood ("Colleges: BCA").
//  3. A suggestions dropdown (places, categories, areas).
//     Arrow keys move through it, Enter picks, Escape closes.
// ---------------------------------------------------------------

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseQuery, describeParse, getSuggestions, type Suggestion } from '../lib/search'
import { swapText } from '../lib/motion'

const EXAMPLES = [
  'Search for latest events in Bangalore',
  'BCA colleges in Jayanagar',
  'Girls PG near Christ under 12000',
  'Metro from Majestic to Whitefield',
  'Biryani in Koramangala',
  'CBSE schools in Whitefield',
  'Plan my day',
  'PG near metro under 9000',
  'Auto fare calculator',
  'Cheap scooter rental',
  'Temples in Basavanagudi',
]

interface Props {
  initial?: string
  size?: 'large' | 'small'
  autoFocus?: boolean
}

export default function SearchBar({ initial = '', size = 'large', autoFocus = false }: Props) {
  const [text, setText] = useState(initial)
  const [open, setOpen] = useState(false) // is the dropdown showing?
  const [active, setActive] = useState(-1) // which suggestion is highlighted
  const navigate = useNavigate()
  const hintRef = useRef<HTMLSpanElement>(null) // the animated placeholder <span>
  const id = useId() // unique ids so two search bars on a page don't clash

  // Rotate the example placeholder every 3.5 seconds
  useEffect(() => {
    let i = 0
    const timer = setInterval(() => {
      i = (i + 1) % EXAMPLES.length
      swapText(hintRef.current, EXAMPLES[i])
    }, 3500)
    return () => clearInterval(timer) // stop the timer when the component goes away
  }, [])

  const parsed = text.trim() ? parseQuery(text) : null
  const understood = parsed ? describeParse(parsed) : ''
  const suggestions = open ? getSuggestions(text) : []

  // Where a suggestion takes you
  const go = (s: Suggestion) => {
    setOpen(false)
    if (s.kind === 'place') navigate(`/place/${s.categoryId}/${s.itemId}`)
    else if (s.kind === 'category') navigate(`/explore/${s.categoryId}`)
    else navigate(`/search?q=${encodeURIComponent(s.query)}`)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault() // stop the browser from reloading the page
    if (active >= 0 && suggestions[active]) {
      go(suggestions[active])
      return
    }
    const q = text.trim()
    if (!q) return
    setOpen(false)
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  // Keyboard support for the dropdown
  const onKeyDown = (e: KeyboardEvent) => {
    if (!suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const listId = `${id}-list`
  return (
    <form className={`search search-${size}`} onSubmit={submit} role="search">
      <label htmlFor={`${id}-input`} className="sr-only">
        Search Bengaluru
      </label>
      <div className="search-field">
        <svg className="search-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M15.5 15.5 L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          id={`${id}-input`}
          type="search"
          value={text}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          aria-describedby={`${id}-understood`}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          // Small delay so a click on a suggestion still registers
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {/* Fake placeholder so we can animate it. Hidden once you type. */}
        {!text && (
          <span className="search-placeholder" aria-hidden="true">
            <span ref={hintRef}>{EXAMPLES[0]}</span>
          </span>
        )}
        <button type="submit" className="btn btn-primary search-btn">
          Search
        </button>

        {suggestions.length > 0 && (
          <ul className="suggestions" id={listId} role="listbox" aria-label="Suggestions">
            {suggestions.map((s, i) => (
              <li
                key={s.label}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'is-active' : ''}
                // onMouseDown fires before the input's onBlur
                onMouseDown={(e) => {
                  e.preventDefault()
                  go(s)
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className={`sugg-kind sugg-${s.kind}`} aria-hidden="true" />
                <span className="sugg-text">
                  <span className="sugg-label">{s.label}</span>
                  <span className="sugg-sub">{s.sub}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p id={`${id}-understood`} className="search-understood" aria-live="polite">
        {understood && (
          <>
            Looking for <strong>{understood}</strong>
          </>
        )}
        {parsed?.corrected && <span className="search-fixed"> (read as "{parsed.corrected}")</span>}
      </p>
    </form>
  )
}
