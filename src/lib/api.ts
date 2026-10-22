// ---------------------------------------------------------------
// api.ts
// Every call from the website to our Express server lives here.
// In development Vite forwards /api/... to the server (see vite.config.ts).
// ---------------------------------------------------------------

import type { CategoryId, ListingsByCategory, Review, ReviewSummary, BaseItem } from '../../shared/types'
import type { NewReview } from '../../shared/schemas'
import { DEMO, DEMO_MESSAGE } from './demo'

/** An error with the server's message, so the UI can show it */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// fetch() with a timeout, JSON parsing and readable errors
async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 4000): Promise<T> {
  // The GitHub Pages demo has no server: fail at once instead of waiting
  if (DEMO) throw new ApiError(0, DEMO_MESSAGE)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    })
    const body = res.status === 204 ? null : await res.json().catch(() => null)
    if (!res.ok) throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`)
    return body as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw new ApiError(0, 'Could not reach the server. Are you offline?')
  } finally {
    clearTimeout(timer)
  }
}

const adminHeaders = (token: string) => ({ Authorization: `Bearer ${token}` })

export const api = {
  listings: () => request<ListingsByCategory>('/api/listings', {}, 2500),
  reviewSummary: () => request<ReviewSummary>('/api/reviews/summary', {}, 2500),
  reviews: (listingKey: string) => request<Review[]>(`/api/reviews?key=${encodeURIComponent(listingKey)}`),
  addReview: (review: NewReview) => request<Review>('/api/reviews', { method: 'POST', body: JSON.stringify(review) }),

  // ---- Admin (needs the admin token) ----
  checkAdmin: (token: string) => request<{ ok: true }>('/api/admin/check', { headers: adminHeaders(token) }),
  allReviews: (token: string) => request<Review[]>('/api/admin/reviews', { headers: adminHeaders(token) }),
  setReviewHidden: (token: string, id: number, hidden: boolean) =>
    request<Review>(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: adminHeaders(token),
      body: JSON.stringify({ hidden }),
    }),
  addListing: (token: string, categoryId: CategoryId, item: Record<string, unknown>) =>
    request<BaseItem>('/api/admin/listings', {
      method: 'POST',
      headers: adminHeaders(token),
      body: JSON.stringify({ categoryId, item }),
    }),
  deleteListing: (token: string, key: string) =>
    request<null>(`/api/admin/listings/${encodeURIComponent(key)}`, { method: 'DELETE', headers: adminHeaders(token) }),
}
