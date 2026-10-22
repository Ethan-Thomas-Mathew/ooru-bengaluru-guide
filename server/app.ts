// ---------------------------------------------------------------
// server/app.ts
// The Express app: every /api route lives here.
// It's a function (createApp) so tests can build an app with an
// in-memory database and their own settings.
//
// Public:
//   GET   /api/health                 is the server up?
//   GET   /api/listings               every listing, grouped by category
//   GET   /api/reviews?key=...        visible reviews for one listing
//   GET   /api/reviews/summary        average rating per listing
//   POST  /api/reviews                add a review (rate limited)
// Admin (needs "Authorization: Bearer <token>"):
//   GET    /api/admin/check
//   GET    /api/admin/reviews
//   PATCH  /api/admin/reviews/:id     { hidden: true/false }
//   POST   /api/admin/listings        { categoryId, item }
//   DELETE /api/admin/listings/:key
// ---------------------------------------------------------------

import express, { type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { createHash, timingSafeEqual, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { z, ZodError } from 'zod'
import { newReviewSchema, newListingSchema, itemSchemas, listingKeySchema } from '../shared/schemas'
import type { BaseItem } from '../shared/types'
import * as store from './db'

export interface AppOptions {
  db: store.Db
  adminToken: string
  /** Max reviews one visitor can post per 10 minutes */
  reviewLimit?: number
  /** Folder with the built website (dist/) to serve, if any */
  staticDir?: string
  /**
   * How many proxies sit in front of this server (e.g. 1 on Render or Fly).
   * Leave at 0 when nothing does (your laptop): otherwise anyone could fake
   * the X-Forwarded-For header to pose as a new visitor and skip rate limits.
   */
  trustProxy?: number
}

/** Shortest admin token we accept. Short ones can be guessed. */
export const MIN_TOKEN_LENGTH = 16

// Short id prefixes, matching the seed data ("c-christ", "f-mtr")
const ID_PREFIX: Record<string, string> = {
  colleges: 'c',
  schools: 's',
  pgs: 'pg',
  gyms: 'g',
  food: 'f',
  rentals: 'r',
  places: 'pl',
  showrooms: 'sh',
  events: 'ev',
}
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)

// Compare tokens in constant time, so attackers can't guess them
// letter by letter by measuring how long the check takes. Hashing first
// makes both sides the same length, so even the length isn't revealed.
const sha256 = (s: string) => createHash('sha256').update(s).digest()
function sameToken(given: string, expected: string): boolean {
  return timingSafeEqual(sha256(given), sha256(expected))
}

export function createApp({ db, adminToken, reviewLimit = 5, staticDir, trustProxy = 0 }: AppOptions) {
  if (adminToken.length < MIN_TOKEN_LENGTH) {
    throw new Error(`ADMIN_TOKEN must be at least ${MIN_TOKEN_LENGTH} characters, so it can't be guessed`)
  }
  const app = express()
  app.disable('x-powered-by')
  // Only believe X-Forwarded-For when a real proxy adds it (see trustProxy above)
  app.set('trust proxy', trustProxy)

  // Security headers. The Content-Security-Policy lists the only outside
  // sites the page may load from: map tiles and Google Fonts.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'img-src': ["'self'", 'data:', 'https://tile.openstreetmap.org'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'connect-src': ["'self'"],
          'script-src': ["'self'"],
          // Off so the site also works over plain http on your laptop or local network
          'upgrade-insecure-requests': null,
        },
      },
    }),
  )
  app.use(express.json({ limit: '20kb' })) // reject huge bodies

  // General limit for the whole API: 300 requests a minute per visitor
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }))

  // ---- Public routes ----------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/api/listings', (_req, res) => {
    res.set('Cache-Control', 'no-cache') // browser may keep a copy but must check it's fresh
    res.json(store.allListings(db))
  })

  app.get('/api/reviews/summary', (_req, res) => {
    res.set('Cache-Control', 'no-cache')
    res.json(store.reviewSummary(db))
  })

  app.get('/api/reviews', (req, res) => {
    const key = listingKeySchema.parse(req.query.key)
    res.json(store.reviewsFor(db, key))
  })

  const reviewLimiter = rateLimit({
    windowMs: 10 * 60_000,
    limit: reviewLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many reviews from you. Try again in a few minutes.' },
  })

  app.post('/api/reviews', reviewLimiter, (req, res) => {
    const review = newReviewSchema.parse(req.body)
    if (!store.listingExists(db, review.listingKey)) {
      res.status(404).json({ error: 'That listing does not exist' })
      return
    }
    res.status(201).json(store.addReview(db, review))
  })

  // ---- Admin routes ------------------------------------------------------
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const header = req.get('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token || !sameToken(token, adminToken)) {
      res.status(401).json({ error: 'Wrong or missing admin token' })
      return
    }
    next()
  }
  // Stop password guessing: 10 wrong tokens per 15 minutes per visitor.
  // Correct tokens don't count towards the limit.
  const adminGuessLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many wrong tokens. Try again in 15 minutes.' },
  })
  const admin = express.Router()
  admin.use(adminGuessLimiter, requireAdmin)

  admin.get('/check', (_req, res) => {
    res.json({ ok: true })
  })

  admin.get('/reviews', (_req, res) => {
    res.json(store.allReviews(db))
  })

  admin.patch('/reviews/:id', (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    const { hidden } = z.object({ hidden: z.boolean() }).parse(req.body)
    const review = store.setReviewHidden(db, id, hidden)
    if (!review) {
      res.status(404).json({ error: 'Review not found' })
      return
    }
    res.json(review)
  })

  admin.post('/listings', (req, res) => {
    const { categoryId, item } = newListingSchema.parse(req.body)
    const fields = itemSchemas[categoryId].parse(item) // throws ZodError if invalid
    const id = `${ID_PREFIX[categoryId]}-${slug(fields.name)}-${randomBytes(2).toString('hex')}`
    const listing = { id, ...fields } as BaseItem
    store.insertListing(db, categoryId, listing)
    res.status(201).json(listing)
  })

  admin.delete('/listings/:key', (req, res) => {
    const key = listingKeySchema.parse(req.params.key)
    if (!store.deleteListing(db, key)) {
      res.status(404).json({ error: 'Not found, or it is built-in data (only admin-added listings can be deleted)' })
      return
    }
    res.status(204).end()
  })

  app.use('/api/admin', admin)

  // Unknown /api path
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'No such API route' })
  })

  // ---- The built website (npm start) ----------------------------------------
  if (staticDir && existsSync(join(staticDir, 'index.html'))) {
    // Files with a hash in their name never change, so browsers can keep them for a year
    app.use('/assets', express.static(join(staticDir, 'assets'), { immutable: true, maxAge: '1y' }))
    app.use(express.static(staticDir, { index: false }))
    // Any other path (/plan, /place/...) -> index.html, React Router takes over
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(join(staticDir, 'index.html'))
    })
  }

  // ---- Errors -------------------------------------------------------------
  // Express 5 sends errors thrown in routes here. Bad input -> 400 with a
  // readable message; anything else -> 500 without leaking details.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      const first = err.issues[0]
      res.status(400).json({ error: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input' })
      return
    }
    // Errors from reading the request body (bad JSON, too big) carry their own status
    const status = (err as { status?: number }).status
    if (err instanceof SyntaxError || status === 400) {
      res.status(400).json({ error: 'Body must be valid JSON' })
      return
    }
    if (status === 413) {
      res.status(413).json({ error: 'Request is too large' })
      return
    }
    console.error(err)
    res.status(500).json({ error: 'Something went wrong on the server' })
  })

  return app
}
