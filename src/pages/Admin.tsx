// ---------------------------------------------------------------
// Admin.tsx  (/admin)
// For you, the site owner. Needs the admin token the server prints
// when it starts (or ADMIN_TOKEN in the .env file).
//   - Hide or show reviews (moderation)
//   - Add a new listing to any category
// ---------------------------------------------------------------

import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { CategoryId, Review } from '../../shared/types'
import { CATEGORY_IDS } from '../../shared/types'
import { itemSchemas } from '../../shared/schemas'
import { getCategory } from '../data/categories'
import { AREA_NAMES } from '../lib/geo'
import { api, ApiError } from '../lib/api'
import { useData } from '../lib/dataContext'
import { usePageTitle } from '../lib/usePageTitle'

const TOKEN_KEY = 'ooru-admin-token'

// ---- Which form fields each category needs ----------------------------
type FieldSpec =
  | { key: string; label: string; kind: 'text' | 'number' | 'list' | 'bool' | 'date' }
  | { key: string; label: string; kind: 'select'; options: string[] }

const COMMON: FieldSpec[] = [
  { key: 'name', label: 'Name', kind: 'text' },
  { key: 'area', label: 'Area', kind: 'select', options: AREA_NAMES },
  { key: 'address', label: 'Street address (optional)', kind: 'text' },
  { key: 'source', label: 'Source link: where you checked the facts (optional)', kind: 'text' },
  { key: 'priceNote', label: 'Price details (optional)', kind: 'text' },
]
const FIELDS: Record<CategoryId, FieldSpec[]> = {
  colleges: [
    { key: 'level', label: 'Level', kind: 'select', options: ['Degree', 'PUC'] },
    { key: 'type', label: 'Stream (e.g. Engineering)', kind: 'text' },
    { key: 'ownership', label: 'Ownership', kind: 'select', options: ['Government', 'Private', 'Deemed'] },
    { key: 'courses', label: 'Courses (comma separated)', kind: 'list' },
    { key: 'feesPerYear', label: 'Fees per year (₹, leave empty if unknown)', kind: 'number' },
  ],
  schools: [
    { key: 'board', label: 'Boards (comma separated)', kind: 'list' },
    { key: 'gender', label: 'For', kind: 'select', options: ['Co-ed', 'Boys', 'Girls'] },
    { key: 'feesPerYear', label: 'Fees per year (₹, leave empty if unknown)', kind: 'number' },
  ],
  pgs: [
    { key: 'gender', label: 'For', kind: 'select', options: ['Boys', 'Girls', 'Co-living'] },
    { key: 'nearCollege', label: 'Near college (name)', kind: 'text' },
    { key: 'sharing', label: 'Sharing (e.g. Single, Double)', kind: 'list' },
    { key: 'rentPerMonth', label: 'Rent per month (₹)', kind: 'number' },
    { key: 'food', label: 'Food included', kind: 'bool' },
    { key: 'amenities', label: 'Amenities (comma separated)', kind: 'list' },
  ],
  gyms: [
    { key: 'type', label: 'Type (Gym, Yoga ...)', kind: 'text' },
    { key: 'monthlyFee', label: 'Monthly fee (₹, leave empty if not published)', kind: 'number' },
    { key: 'open24x7', label: 'Open 24x7', kind: 'bool' },
    { key: 'womenOnly', label: 'Women only', kind: 'bool' },
    { key: 'amenities', label: 'Amenities (comma separated)', kind: 'list' },
  ],
  food: [
    { key: 'cuisine', label: 'Cuisine', kind: 'text' },
    { key: 'diet', label: 'Diet', kind: 'select', options: ['Veg', 'Non-veg', 'Both'] },
    { key: 'costForTwo', label: 'Cost for two (₹)', kind: 'number' },
    { key: 'knownFor', label: 'Known for', kind: 'text' },
  ],
  rentals: [
    { key: 'provider', label: 'Provider', kind: 'text' },
    { key: 'vehicleType', label: 'Vehicle', kind: 'select', options: ['Bike', 'Scooter', 'Car'] },
    { key: 'model', label: 'Model', kind: 'text' },
    { key: 'pricePerDay', label: 'Price per day (₹, leave empty if not published)', kind: 'number' },
    { key: 'deposit', label: 'Deposit (₹, 0 = none, empty = unknown)', kind: 'number' },
  ],
  places: [
    { key: 'kind', label: 'Kind (Temple, Park, Museum ...)', kind: 'text' },
    { key: 'group', label: 'Group', kind: 'select', options: ['Sightseeing', 'Religious'] },
    { key: 'entryFee', label: 'Entry fee (₹, 0 = free, empty = unknown)', kind: 'number' },
    { key: 'timings', label: 'Timings (e.g. 9 AM – 6 PM)', kind: 'text' },
    { key: 'visitMins', label: 'Minutes people spend there', kind: 'number' },
  ],
  showrooms: [
    { key: 'brand', label: 'Brand', kind: 'text' },
    { key: 'segment', label: 'Segments (comma separated)', kind: 'list' },
    { key: 'services', label: 'Services (comma separated)', kind: 'list' },
  ],
  events: [
    { key: 'kind', label: 'Kind (Run, Walk, Festival ...)', kind: 'text' },
    { key: 'date', label: 'Date', kind: 'date' },
    { key: 'venue', label: 'Venue', kind: 'text' },
    { key: 'distances', label: 'Distances (comma separated)', kind: 'list' },
    { key: 'organizer', label: 'Organizer', kind: 'text' },
  ],
}

// Turn the form's text values into the right types (numbers, lists, booleans)
function buildItem(specs: FieldSpec[], values: Record<string, string | boolean>) {
  const item: Record<string, unknown> = {}
  for (const f of specs) {
    const v = values[f.key]
    if (f.kind === 'bool') item[f.key] = v === true
    else if (f.kind === 'number') {
      if (v !== '' && v !== undefined) item[f.key] = Number(v)
    } else if (f.kind === 'list')
      item[f.key] = String(v ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    else {
      // Leave empty text out, so optional fields stay optional
      const text = String(v ?? '').trim()
      if (text) item[f.key] = text
    }
  }
  // A source link was checked today
  if (item.source) item.checked = new Date().toISOString().slice(0, 10)
  return item
}

// ---- Add listing form ---------------------------------------------------
function AddListing({ token }: { token: string }) {
  const [categoryId, setCategoryId] = useState<CategoryId>('food')
  const [values, setValues] = useState<Record<string, string | boolean>>({})
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const { refresh } = useData()
  const specs = [...COMMON, ...FIELDS[categoryId]]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setMessage('')
    const item = buildItem(specs, values)
    // Same rules as the server (shared/schemas.ts)
    const check = itemSchemas[categoryId].safeParse(item)
    if (!check.success) {
      setErrors(check.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`))
      return
    }
    setErrors([])
    try {
      const saved = await api.addListing(token, categoryId, item)
      setMessage(`Added "${saved.name}".`)
      setValues({})
      await refresh()
    } catch (err) {
      setErrors([err instanceof ApiError ? err.message : 'Could not save.'])
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <h2>Add a listing</h2>
      <label className="field">
        <span>Category</span>
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value as CategoryId)
            setValues({})
            setErrors([])
          }}
        >
          {CATEGORY_IDS.map((id) => (
            <option key={id} value={id}>
              {getCategory(id)?.name}
            </option>
          ))}
        </select>
      </label>
      <div className="admin-fields">
        {specs.map((f) => {
          const value = values[f.key]
          if (f.kind === 'bool') {
            return (
              <label key={f.key} className="check">
                <input
                  type="checkbox"
                  checked={value === true}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.checked })}
                />
                <span>{f.label}</span>
              </label>
            )
          }
          return (
            <label key={f.key} className="field">
              <span>{f.label}</span>
              {f.kind === 'select' ? (
                <select value={String(value ?? '')} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                  <option value="">Choose…</option>
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.kind === 'number' ? 'number' : f.kind === 'date' ? 'date' : 'text'}
                  value={String(value ?? '')}
                  step={f.key === 'rating' ? 0.1 : undefined}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              )}
            </label>
          )
        })}
      </div>
      {errors.length > 0 && (
        <ul className="field-error" role="alert">
          {errors.map((er) => (
            <li key={er}>{er}</li>
          ))}
        </ul>
      )}
      {message && (
        <p className="field-ok" role="status">
          {message}
        </p>
      )}
      <button type="submit" className="btn btn-primary">
        Add listing
      </button>
    </form>
  )
}

// ---- Review moderation ----------------------------------------------------
function ReviewModeration({ token }: { token: string }) {
  const [reviews, setReviews] = useState<Review[] | null>(null)
  const [error, setError] = useState('')
  const { refresh } = useData()

  useEffect(() => {
    api
      .allReviews(token)
      .then(setReviews)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load'))
  }, [token])

  const toggle = async (r: Review) => {
    const updated = await api.setReviewHidden(token, r.id, !r.hidden)
    setReviews((list) => list?.map((x) => (x.id === r.id ? updated : x)) ?? null)
    void refresh()
  }

  return (
    <section className="admin-reviews">
      <h2>Reviews</h2>
      {error && <p className="field-error">{error}</p>}
      {reviews?.length === 0 && <p className="muted">No reviews yet.</p>}
      <ul className="review-list">
        {reviews?.map((r) => (
          <li key={r.id} className={r.hidden ? 'is-hidden' : ''}>
            <div className="review-head">
              <strong>{r.name}</strong>
              <span>{r.rating}★</span>
              <Link to={`/place/${r.listingKey.replace(':', '/')}`} className="small">
                {r.listingKey}
              </Link>
              <button type="button" className="btn btn-quiet small-btn" onClick={() => toggle(r)}>
                {r.hidden ? 'Show again' : 'Hide'}
              </button>
            </div>
            <p>{r.text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---- The page -----------------------------------------------------------
export default function Admin() {
  usePageTitle('Admin')
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) ?? '')
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const signIn = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api.checkAdmin(input.trim())
      sessionStorage.setItem(TOKEN_KEY, input.trim()) // forgotten when the tab closes
      setToken(input.trim())
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in')
    }
  }

  if (!token) {
    return (
      <div className="wrap page admin">
        <h1>Admin</h1>
        <form className="admin-login" onSubmit={signIn}>
          <label className="field">
            <span>Admin token</span>
            <input type="password" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" />
          </label>
          <button type="submit" className="btn btn-primary">
            Sign in
          </button>
          {error && <p className="field-error">{error}</p>}
          <p className="muted small">The server prints the token in the terminal when it starts.</p>
        </form>
      </div>
    )
  }

  return (
    <div className="wrap page admin">
      <div className="section-head">
        <h1>Admin</h1>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            sessionStorage.removeItem(TOKEN_KEY)
            setToken('')
          }}
        >
          Sign out
        </button>
      </div>
      <div className="admin-grid">
        <AddListing token={token} />
        <ReviewModeration token={token} />
      </div>
    </div>
  )
}
