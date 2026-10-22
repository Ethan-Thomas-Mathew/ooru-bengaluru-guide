// Database tests: seeding keeps the database in step with src/data/*.json
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { addReview, insertListing, listingExists, openDb, seedListings } from './db'

const DATA = join(import.meta.dirname, '..', 'src', 'data')

describe('seedListings', () => {
  it('removes seed rows that are no longer in the JSON files, but keeps admin rows', () => {
    const db = openDb(':memory:')
    // An old listing from an earlier version of the files, with a review
    db.prepare("INSERT INTO listings (key, category, data, source) VALUES (?, 'pgs', '{}', 'seed')").run('pgs:pg-old')
    addReview(db, { listingKey: 'pgs:pg-old', name: 'Ravi', rating: 4, text: 'An old review of an old PG.' })
    // A listing the admin added by hand
    insertListing(db, 'food', { id: 'f-admin', name: 'Admin cafe', area: 'Jayanagar' })

    seedListings(db, DATA)

    expect(listingExists(db, 'pgs:pg-old')).toBe(false) // gone
    expect(db.prepare("SELECT COUNT(*) AS n FROM reviews WHERE listing_key = 'pgs:pg-old'").get()).toEqual({ n: 0 })
    expect(listingExists(db, 'food:f-admin')).toBe(true) // admin rows are never touched
    expect(listingExists(db, 'pgs:pg-salzburg')).toBe(true) // current files are loaded
  })

  it('stores no made-up ratings', () => {
    const db = openDb(':memory:')
    seedListings(db, DATA)
    const rows = db.prepare('SELECT data FROM listings').all() as { data: string }[]
    for (const row of rows) expect(JSON.parse(row.data).rating).toBeUndefined()
  })
})
