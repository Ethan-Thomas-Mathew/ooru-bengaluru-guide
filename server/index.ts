// ---------------------------------------------------------------
// server/index.ts
// Starts the API server.
//   npm run dev    -> this server on port 3001 + Vite on 5173 (Vite forwards /api here)
//   npm start      -> builds the website, then this server serves BOTH on port 3001
//
// Settings come from a .env file (copy .env.example to .env):
//   PORT          default 3001
//   ADMIN_TOKEN   password for /admin. If empty, one is generated and saved
//                 in server/data/admin-token.txt
//   DB_FILE       default server/data/ooru.db
//   TRUST_PROXY   0 (default) when people connect straight to this server;
//                 1 when a host's proxy sits in front (Render, Railway, Fly)
// ---------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { createApp } from './app'
import { openDb, seedListings } from './db'

const root = join(import.meta.dirname, '..')

// Load .env if it exists (built into Node 20.12+, no extra package)
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'))

const PORT = Number(process.env.PORT ?? 3001)
const DB_FILE = process.env.DB_FILE ?? join(root, 'server', 'data', 'ooru.db')
const TRUST_PROXY = Number(process.env.TRUST_PROXY ?? 0)
const serveSite = process.argv.includes('--serve')

// Admin token: from .env, or a saved generated one, or make a new one
function adminToken(): string {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN
  const dir = join(root, 'server', 'data')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'admin-token.txt')
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  const token = randomBytes(16).toString('hex') // 32 characters, impossible to guess
  writeFileSync(file, token, { mode: 0o600 }) // only your user account can read it
  return token
}

const db = openDb(DB_FILE)
const seeded = seedListings(db, join(root, 'src', 'data'))
const token = adminToken()

let app: ReturnType<typeof createApp>
try {
  app = createApp({
    db,
    adminToken: token,
    trustProxy: TRUST_PROXY,
    staticDir: serveSite ? join(root, 'dist') : undefined,
  })
} catch (err) {
  // e.g. ADMIN_TOKEN in .env is too short: explain and stop
  console.error(`\n  Can't start: ${(err as Error).message}`)
  console.error('  Fix ADMIN_TOKEN in your .env file, or delete it to get a strong one generated.\n')
  process.exit(1)
}

const server = app.listen(PORT, () => {
  console.log(`\n  API ready on http://localhost:${PORT}  (${seeded} listings loaded)`)
  if (serveSite) console.log(`  Website on  http://localhost:${PORT}`)
  console.log(`  Admin token: ${token}  (open /admin on the website)\n`)
})

// Close the database cleanly on Ctrl+C
const shutdown = () => {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
