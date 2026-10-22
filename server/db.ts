// ---------------------------------------------------------------
// server/db.ts
// The database: SQLite, built into Node.js (node:sqlite), so there's
// nothing extra to install. Everything lives in one file:
// server/data/ooru.db (created automatically, not committed to git).
//
// Two tables:
//   listings  every college, PG, gym... (one row each, data as JSON)
//   reviews   reviews people post, linked to a listing by its key
// ---------------------------------------------------------------

import { DatabaseSync } from 'node:sqlite'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { CATEGORY_IDS, type BaseItem, type CategoryId, type Review } from '../shared/types'

export type Db = DatabaseSync

/** Open (or create) the database and make sure the tables exist */
export function openDb(file: string): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL;') // faster, safe for one server
  db.exec('PRAGMA foreign_keys = ON;') // a review can't point at a missing listing
  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      key        TEXT PRIMARY KEY,          -- "colleges:c-christ"
      category   TEXT NOT NULL,
      data       TEXT NOT NULL,             -- the listing as JSON
      source     TEXT NOT NULL DEFAULT 'seed', -- 'seed' (from JSON files) or 'admin'
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_key TEXT NOT NULL REFERENCES listings(key) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      text        TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      hidden      INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_listing ON reviews (listing_key);
  `)
  return db
}

/**
 * Copy the listings from src/data/*.json into the database.
 * Runs on every start: seed rows are updated to match the JSON files,
 * seed rows that were removed from the files are deleted (with their
 * reviews), and rows added by the admin are never touched.
 */
export function seedListings(db: Db, dataDir: string): number {
  const upsert = db.prepare(`
    INSERT INTO listings (key, category, data, source) VALUES (?, ?, ?, 'seed')
    ON CONFLICT(key) DO UPDATE SET data = excluded.data WHERE listings.source = 'seed'
  `)
  const keys: string[] = []
  db.exec('BEGIN') // one transaction = much faster than hundreds of separate writes
  try {
    for (const category of CATEGORY_IDS) {
      const items = JSON.parse(readFileSync(join(dataDir, `${category}.json`), 'utf8')) as BaseItem[]
      for (const item of items) {
        const key = `${category}:${item.id}`
        upsert.run(key, category, JSON.stringify(item))
        keys.push(key)
      }
    }
    // Remove seed rows that are no longer in the JSON files.
    // One "?" per key, so the keys are still sent safely as values.
    db.prepare(`DELETE FROM listings WHERE source = 'seed' AND key NOT IN (${keys.map(() => '?').join(',')})`).run(
      ...keys,
    )
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return keys.length
}

// ---- Listings ---------------------------------------------------------

export function allListings(db: Db): Record<CategoryId, BaseItem[]> {
  const result = Object.fromEntries(CATEGORY_IDS.map((c) => [c, [] as BaseItem[]])) as Record<CategoryId, BaseItem[]>
  const rows = db.prepare('SELECT category, data FROM listings ORDER BY rowid').all() as {
    category: CategoryId
    data: string
  }[]
  for (const row of rows) result[row.category]?.push(JSON.parse(row.data))
  return result
}

export function listingExists(db: Db, key: string): boolean {
  return db.prepare('SELECT 1 FROM listings WHERE key = ?').get(key) !== undefined
}

export function insertListing(db: Db, category: CategoryId, item: BaseItem): void {
  db.prepare("INSERT INTO listings (key, category, data, source) VALUES (?, ?, ?, 'admin')").run(
    `${category}:${item.id}`,
    category,
    JSON.stringify(item),
  )
}

/** Deletes an admin-added listing. Returns false if it doesn't exist or came from the seed files. */
export function deleteListing(db: Db, key: string): boolean {
  return db.prepare("DELETE FROM listings WHERE key = ? AND source = 'admin'").run(key).changes > 0
}

// ---- Reviews ----------------------------------------------------------

interface ReviewRow {
  id: number
  listing_key: string
  name: string
  rating: number
  text: string
  created_at: string
  hidden: number
}
const toReview = (r: ReviewRow): Review => ({
  id: r.id,
  listingKey: r.listing_key,
  name: r.name,
  rating: r.rating,
  text: r.text,
  createdAt: r.created_at,
  hidden: r.hidden === 1,
})

export function reviewsFor(db: Db, key: string): Review[] {
  const rows = db
    .prepare('SELECT * FROM reviews WHERE listing_key = ? AND hidden = 0 ORDER BY id DESC LIMIT 100')
    .all(key) as unknown as ReviewRow[]
  return rows.map(toReview)
}

export function allReviews(db: Db): Review[] {
  return (db.prepare('SELECT * FROM reviews ORDER BY id DESC LIMIT 500').all() as unknown as ReviewRow[]).map(toReview)
}

export function addReview(db: Db, r: { listingKey: string; name: string; rating: number; text: string }): Review {
  const createdAt = new Date().toISOString()
  // "?" placeholders: values are sent separately, so text like
  // "'); DROP TABLE reviews;--" can never run as SQL (no SQL injection)
  const { lastInsertRowid } = db
    .prepare('INSERT INTO reviews (listing_key, name, rating, text, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(r.listingKey, r.name, r.rating, r.text, createdAt)
  return { id: Number(lastInsertRowid), ...r, createdAt, hidden: false }
}

export function setReviewHidden(db: Db, id: number, hidden: boolean): Review | null {
  db.prepare('UPDATE reviews SET hidden = ? WHERE id = ?').run(hidden ? 1 : 0, id)
  const row = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id) as unknown as ReviewRow | undefined
  return row ? toReview(row) : null
}

/** Average rating + count for every listing that has visible reviews */
export function reviewSummary(db: Db): Record<string, { count: number; average: number }> {
  const rows = db
    .prepare(
      'SELECT listing_key, COUNT(*) AS count, AVG(rating) AS average FROM reviews WHERE hidden = 0 GROUP BY listing_key',
    )
    .all() as { listing_key: string; count: number; average: number }[]
  return Object.fromEntries(
    rows.map((r) => [r.listing_key, { count: r.count, average: Math.round(r.average * 10) / 10 }]),
  )
}
