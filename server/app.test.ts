// API tests: each test gets a fresh in-memory database, so tests never
// touch your real data and can run in any order.
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { join } from 'node:path'
import { createApp } from './app'
import { openDb, seedListings } from './db'

const TOKEN = 'test-admin-token'
let app: ReturnType<typeof createApp>

beforeEach(() => {
  const db = openDb(':memory:')
  seedListings(db, join(import.meta.dirname, '..', 'src', 'data'))
  app = createApp({ db, adminToken: TOKEN, reviewLimit: 3 })
})

const goodReview = { listingKey: 'food:f-mtr', name: 'Asha', rating: 5, text: 'Great rava idli and coffee.' }

describe('listings', () => {
  it('returns every category', async () => {
    const res = await request(app).get('/api/listings').expect(200)
    expect(res.body.colleges.length).toBeGreaterThan(10)
    expect(res.body.food.find((f: { id: string }) => f.id === 'f-mtr')).toBeTruthy()
  })
})

describe('reviews', () => {
  it('adds a review and shows it in the summary', async () => {
    await request(app).post('/api/reviews').send(goodReview).expect(201)
    const list = await request(app).get('/api/reviews?key=food:f-mtr').expect(200)
    expect(list.body).toHaveLength(1)
    const summary = await request(app).get('/api/reviews/summary').expect(200)
    expect(summary.body['food:f-mtr']).toEqual({ count: 1, average: 5 })
  })

  it('rejects invalid reviews with a clear message', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .send({ ...goodReview, rating: 9 })
      .expect(400)
    expect(res.body.error).toMatch(/rating/)
    await request(app)
      .post('/api/reviews')
      .send({ ...goodReview, text: 'see www.spam.com now' })
      .expect(400)
  })

  it('rejects reviews for listings that do not exist', async () => {
    await request(app)
      .post('/api/reviews')
      .send({ ...goodReview, listingKey: 'food:nope' })
      .expect(404)
  })

  it('stores text safely (no SQL injection)', async () => {
    const sneaky = { ...goodReview, text: "'); DROP TABLE reviews; -- nice place" }
    await request(app).post('/api/reviews').send(sneaky).expect(201)
    const list = await request(app).get('/api/reviews?key=food:f-mtr').expect(200)
    expect(list.body[0].text).toBe(sneaky.text)
  })

  it('rate limits review spam', async () => {
    for (let i = 0; i < 3; i++) await request(app).post('/api/reviews').send(goodReview).expect(201)
    await request(app).post('/api/reviews').send(goodReview).expect(429)
  })
})

describe('admin', () => {
  const auth = { Authorization: `Bearer ${TOKEN}` }

  it('refuses requests without the right token', async () => {
    await request(app).get('/api/admin/check').expect(401)
    await request(app).get('/api/admin/check').set({ Authorization: 'Bearer wrong' }).expect(401)
    await request(app).get('/api/admin/check').set(auth).expect(200)
  })

  it('hides a review', async () => {
    const created = await request(app).post('/api/reviews').send(goodReview).expect(201)
    await request(app).patch(`/api/admin/reviews/${created.body.id}`).set(auth).send({ hidden: true }).expect(200)
    const list = await request(app).get('/api/reviews?key=food:f-mtr').expect(200)
    expect(list.body).toHaveLength(0)
  })

  it('adds a listing, then deletes it', async () => {
    const item = {
      name: 'Test Darshini',
      area: 'Jayanagar',
      cuisine: 'South Indian',
      diet: 'Veg',
      costForTwo: 150,
      knownFor: 'Idli',
    }
    const res = await request(app).post('/api/admin/listings').set(auth).send({ categoryId: 'food', item }).expect(201)
    expect(res.body.id).toMatch(/^f-test-darshini-/)
    const listings = await request(app).get('/api/listings')
    expect(listings.body.food.some((f: { name: string }) => f.name === 'Test Darshini')).toBe(true)
    await request(app).delete(`/api/admin/listings/food:${res.body.id}`).set(auth).expect(204)
  })

  it('validates new listings', async () => {
    await request(app)
      .post('/api/admin/listings')
      .set(auth)
      .send({ categoryId: 'food', item: { name: 'X' } })
      .expect(400)
  })

  it('will not delete built-in listings', async () => {
    await request(app).delete('/api/admin/listings/food:f-mtr').set(auth).expect(404)
  })
})

describe('errors', () => {
  it('returns JSON 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/nope').expect(404)
    expect(res.body.error).toBeTruthy()
  })
  it('handles broken JSON', async () => {
    await request(app).post('/api/reviews').set('Content-Type', 'application/json').send('{bad').expect(400)
  })
})

// ---- Security checks (each one is an attack that must fail) ----------------
describe('security', () => {
  const auth = { Authorization: `Bearer ${TOKEN}` }
  const spam = { listingKey: 'food:f-mtr', name: 'Spammer', rating: 1, text: 'spam spam spam spam' }

  it('refuses to start with a short admin token', () => {
    const db = openDb(':memory:')
    expect(() => createApp({ db, adminToken: 'admin123' })).toThrow(/at least 16/)
  })

  it('does not let a fake X-Forwarded-For header skip the review limit', async () => {
    // reviewLimit is 3 in these tests; each request pretends to be a new visitor
    for (let i = 1; i <= 3; i++) {
      await request(app).post('/api/reviews').set('X-Forwarded-For', `10.0.0.${i}`).send(spam).expect(201)
    }
    await request(app).post('/api/reviews').set('X-Forwarded-For', '10.0.0.99').send(spam).expect(429)
  })

  it('blocks admin token guessing after 10 wrong tries', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app).get('/api/admin/check').set('Authorization', `Bearer wrong-guess-${i}`).expect(401)
    }
    await request(app).get('/api/admin/check').set('Authorization', 'Bearer wrong-guess-again').expect(429)
  })

  it('does not count correct tokens as guesses', async () => {
    for (let i = 0; i < 15; i++) await request(app).get('/api/admin/check').set(auth).expect(200)
  })

  it('answers 413 (not a crash) for a body that is too big', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'x'.repeat(100_000) }))
      .expect(413)
    expect(res.body.error).toMatch(/too large/)
  })

  it('rejects javascript: links as a listing source', async () => {
    const item = {
      name: 'Link Test',
      area: 'Jayanagar',
      cuisine: 'Cafe',
      diet: 'Veg',
      costForTwo: 300,
      knownFor: 'x',
      source: 'javascript:alert(1)',
    }
    await request(app).post('/api/admin/listings').set(auth).send({ categoryId: 'food', item }).expect(400)
  })

  it('drops unknown and dangerous fields from new listings', async () => {
    const item = JSON.parse(
      '{"name":"Field Test","area":"Jayanagar","cuisine":"Cafe","diet":"Veg","costForTwo":300,"knownFor":"x","rating":5,"evil":"<script>","__proto__":{"isAdmin":true}}',
    )
    const res = await request(app).post('/api/admin/listings').set(auth).send({ categoryId: 'food', item }).expect(201)
    expect(res.body.rating).toBeUndefined()
    expect(res.body.evil).toBeUndefined()
    expect(({} as { isAdmin?: boolean }).isAdmin).toBeUndefined()
  })

  it('stores SQL-looking text as plain text', async () => {
    const sneaky = { ...goodReview, text: "'); DROP TABLE listings; -- still just text" }
    await request(app).post('/api/reviews').send(sneaky).expect(201)
    const res = await request(app).get('/api/listings').expect(200)
    expect(res.body.food.length).toBeGreaterThan(0)
  })
})
