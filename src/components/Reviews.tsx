// ---------------------------------------------------------------
// Reviews.tsx
// Reviews for one listing: the list, plus a form to add one.
// The form checks input with the same zod rules the server uses
// (shared/schemas.ts), so errors show up before anything is sent.
// ---------------------------------------------------------------

import { useEffect, useState, type FormEvent } from 'react'
import type { Review } from '../../shared/types'
import { newReviewSchema } from '../../shared/schemas'
import { api, ApiError } from '../lib/api'
import { useData } from '../lib/dataContext'

const STARS = [1, 2, 3, 4, 5]

function Stars({ value }: { value: number }) {
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {STARS.map((s) => (
        <span key={s} aria-hidden="true" className={s <= value ? 'on' : ''}>
          ★
        </span>
      ))}
    </span>
  )
}

export default function Reviews({ listingKey, name }: { listingKey: string; name: string }) {
  const [reviews, setReviews] = useState<Review[] | null>(null) // null = loading
  const [offline, setOffline] = useState(false)
  const [form, setForm] = useState({ name: '', rating: 0, text: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const { refresh } = useData()

  // Load reviews when the listing changes
  useEffect(() => {
    let cancelled = false // ignore the answer if the user already left
    api
      .reviews(listingKey)
      .then((r) => !cancelled && setReviews(r))
      .catch(() => {
        if (!cancelled) {
          setOffline(true)
          setReviews([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [listingKey])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const check = newReviewSchema.safeParse({ listingKey, ...form })
    if (!check.success) {
      // Turn zod's error list into { fieldName: "message" }
      const next: Record<string, string> = {}
      for (const issue of check.error.issues) next[String(issue.path[0])] ??= issue.message
      if (form.rating === 0) next.rating = 'Pick a star rating'
      setErrors(next)
      return
    }
    setErrors({})
    setStatus('sending')
    try {
      const saved = await api.addReview(check.data)
      setReviews((list) => [saved, ...(list ?? [])])
      setForm({ name: '', rating: 0, text: '' })
      setStatus('sent')
      void refresh() // update the average rating shown on cards
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'Something went wrong. Try again.' })
      setStatus('idle')
    }
  }

  return (
    <section className="detail-section reviews" aria-labelledby="reviews-title">
      <h2 id="reviews-title">Reviews</h2>

      {reviews === null && <p className="muted">Loading reviews…</p>}
      {offline && (
        <p className="notice">
          Reviews need the server. Start it with <code>npm run dev</code>, or check your connection.
        </p>
      )}
      {reviews && reviews.length === 0 && !offline && (
        <p className="muted">No reviews yet. Be the first to review {name}.</p>
      )}
      {reviews && reviews.length > 0 && (
        <ul className="review-list">
          {reviews.map((r) => (
            <li key={r.id}>
              <div className="review-head">
                <strong>{r.name}</strong>
                <Stars value={r.rating} />
                <span className="muted small">
                  {new Date(r.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <p>{r.text}</p>
            </li>
          ))}
        </ul>
      )}

      {!offline && (
        <form className="review-form" onSubmit={submit} noValidate>
          <h3>Write a review</h3>
          <fieldset className="star-input">
            <legend>Your rating</legend>
            {STARS.map((s) => (
              <label key={s}>
                <input
                  type="radio"
                  name="rating"
                  value={s}
                  checked={form.rating === s}
                  onChange={() => setForm({ ...form, rating: s })}
                />
                <span aria-hidden="true">★</span>
                <span className="sr-only">
                  {s} star{s > 1 ? 's' : ''}
                </span>
              </label>
            ))}
          </fieldset>
          {errors.rating && <p className="field-error">{errors.rating}</p>}

          <label className="field">
            <span>Your name</span>
            <input
              value={form.name}
              maxLength={40}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-invalid={!!errors.name}
            />
          </label>
          {errors.name && <p className="field-error">{errors.name}</p>}

          <label className="field">
            <span>Your review</span>
            <textarea
              rows={4}
              maxLength={800}
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              aria-invalid={!!errors.text}
            />
          </label>
          {errors.text && <p className="field-error">{errors.text}</p>}
          {errors.form && <p className="field-error">{errors.form}</p>}

          <button type="submit" className="btn btn-primary" disabled={status === 'sending'}>
            {status === 'sending' ? 'Posting…' : 'Post review'}
          </button>
          {status === 'sent' && (
            <p className="field-ok" role="status">
              Review posted. Thanks!
            </p>
          )}
        </form>
      )}
    </section>
  )
}
