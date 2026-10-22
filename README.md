# Ooru: a Bengaluru city guide

A full-stack web app for students and newcomers in Bengaluru: colleges (with NIRF 2025 ranks),
PGs ranked by commute, food, gyms, rentals, places, events, bus and metro routes, a day planner
with rush-hour and rain delays, a move-in cost estimator, auto/metro fare calculators, and a
pocket Kannada phrasebook.

**Stack:** React 19 + TypeScript + Vite, anime.js v4, Leaflet + OpenStreetMap, Express 5,
SQLite (built into Node), zod, Vitest, installable as an offline app (PWA).

---

**Live demo:** https://ethan-thomas-mathew.github.io/ooru-bengaluru-guide/
(a static demo on GitHub Pages: reviews and admin need the server, so they're turned off there)

## Run it

You need **Node.js 22.13 or newer** (the LTS from https://nodejs.org is fine). Check with `node -v`.

```bash
npm install        # first time, and after pulling new changes
npm run dev        # website on http://localhost:5173 + API on http://localhost:3001
```

`npm run dev` starts two things side by side: the website (Vite) and the API server (Express).
The terminal prints an **admin token**: use it on http://localhost:5173/admin to hide reviews
or add listings. To pick your own token, copy `.env.example` to `.env` and set `ADMIN_TOKEN`.

The website still works if the API isn't running (it falls back to the data built into the app),
but reviews and admin need the server.

### Other commands

| Command             | What it does                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `npm start`         | Builds the site, then serves site + API together on http://localhost:3001 (like production) |
| `npm test`          | Runs all tests once (67 tests: search, fares, planner maths, share links, API, data checks) |
| `npm run check`     | Type-check + lint + tests. Run this before you commit                                       |
| `npm run typecheck` | TypeScript only                                                                             |
| `npm run lint`      | oxlint only                                                                                 |
| `npm run format`    | Auto-format the code with Prettier                                                          |

---

## Features

- **Smart search**: understands plain sentences ("girls pg near christ under 12000"), fixes typos
  ("biriyani in koramangla"), knows area nicknames (Ulsoor, E-City), and suggests as you type.
- **Results** as a list or on a map, with filters, sorting and smooth re-ordering (anime.js `createLayout`).
- **Move-in kit** (`/move-in`): pick a college, get PGs ranked by commute, cheap food and gyms
  nearby, and a monthly cost estimate.
- **Commute + metro**: every listing shows its nearest metro station and walk time; PGs show bus/metro
  minutes to their college; "Metro within 15 min walk" filter.
- **Day planner** (`/plan`): add places, choose car/bike/bus+metro/walking; it adds rush-hour delays,
  waits for opening hours, suggests a better start time, finds a shorter order, estimates auto fare,
  draws the route on a map, and makes a **share link** (the whole plan is inside the link).
- **Rain mode** (header switch): adds rain delays, flags outdoor places and spots that flood, and
  suggests indoor places nearby.
- **Newcomer pack** (`/newcomer`): auto fare and metro fare calculators, pocket Kannada.
- **Reviews**: anyone can post with a name. Star ratings come only from these reviews; nothing is rated until someone reviews it.
  Spam protection: validation, no links, rate limit (5 per 10 minutes per visitor).
- **Admin** (`/admin`): hide/show reviews, add listings.
- **Offline**: install it from the browser (it's a PWA). Pages, listings and map tiles you've seen keep working offline.

---

## How the code is organised

```
shared/                 code used by BOTH the website and the server
  types.ts              data shapes (College, Pg, Review ...)
  schemas.ts            zod validation rules (server + forms use the same ones)

server/                 the API (Express + SQLite)
  index.ts              starts the server, loads .env, prints the admin token
  app.ts                every /api route, security headers, rate limits, error handling
  db.ts                 database tables, seeding from src/data/*.json, queries
  app.test.ts           API tests (fresh in-memory database for each test)

src/                    the website (React)
  main.tsx, App.tsx     start-up, routes (pages load lazily = smaller first download)
  index.css             all styles (colours and fonts at the top)
  data/                 listings (*.json), areas.json (rough location of each area),
                        transit.json (metro lines, station positions, buses), rain.json,
                        categories.ts (filters, sorting, card layout per category)
  lib/                  logic with no UI, most of it tested:
    search.ts           sentence -> category + filters, typo fixing, suggestions
    fuzzy.ts            edit distance (Levenshtein) for typo fixing
    filters.ts          applying filters and sorting
    geo.ts              distances (haversine), area positions, map pins
    transit.ts          metro route finder (BFS), nearest station, bus search
    traffic.ts          rush-hour and rain slow-down model
    itinerary.ts        planner maths: schedule, best order (greedy + 2-opt), best start time
    fares.ts            auto and metro fares
    enrich.ts           adds nearest metro + commute minutes to every listing
    plan.ts             the day plan in the browser + share-link encoding
    api.ts              calls to the server
    dataStore.tsx       loads server data, falls back to built-in data
    motion.ts           every anime.js animation
  components/           Header, SearchBar, MapView, ResultCard, Reviews, FilterPanel ...
  pages/                Home, Results, Detail, Planner, MoveIn, Newcomer, Transit, Saved, Admin, Legal
```

### Algorithms worth knowing for interviews

| Where              | Algorithm                                           | Why                                                            |
| ------------------ | --------------------------------------------------- | -------------------------------------------------------------- |
| `lib/fuzzy.ts`     | Edit distance (dynamic programming) with early exit | Typo-tolerant search                                           |
| `lib/transit.ts`   | Breadth-first search on the metro graph             | Fewest-stops route with interchanges                           |
| `lib/geo.ts`       | Haversine formula                                   | Distance between two lat/lng points                            |
| `lib/itinerary.ts` | Greedy nearest neighbour + 2-opt                    | "Best order": a fast answer to the travelling salesman problem |
| `lib/itinerary.ts` | Search over start times                             | "Leave at 8:15 to save 25 min"                                 |
| `lib/plan.ts`      | Base64url encoding                                  | Whole plan fits in a share link                                |

### Design decisions

- **The site works without the server.** Data is bundled; the server version replaces it when
  reachable. That's why the home page is instant and the site works offline.
- **One set of validation rules** (`shared/schemas.ts`) for the server and the forms.
- **SQLite via `node:sqlite`**: no database to install, one file, real SQL with placeholders
  (safe from SQL injection; there's a test for it).
- **Security:** helmet headers with a Content-Security-Policy, request size limits, rate limits
  (reviews, and 10 wrong admin tokens per 15 minutes), admin tokens of at least 16 characters
  compared in constant time, the X-Forwarded-For header ignored unless `TRUST_PROXY` is set (so
  nobody can fake a new IP to dodge limits), http(s)-only source links, and JSON-only errors that
  don't leak internals. The attacks are tested in `server/app.test.ts` ("security").

---

## About the data

Every listing is a real place. Nothing is made up: if we couldn't confirm a number, the site says
so ("Ask at the gym", "Check before going") instead of guessing.

- **PGs:** 23 Stanza Living residences near colleges, with rents, sharing types and addresses from
  each residence's page on stanzaliving.com (checked 22 Oct 2026).
- **Gyms:** cult.fit, Gold's Gym and Anytime Fitness branches from their own sites, and
  women-only gyms from LyfSkills listings. Most gyms don't publish fees, so those show
  "Ask at the gym". Gold's Gym fees are their published yearly price.
- **Rentals:** Royal Brothers (from its tariff page), ONN Bikes (its own "from about ₹249/day")
  and Revv cars (day prices on its Bangalore page).
- **Showrooms:** real dealers and addresses (Times Drive and Autocar India dealer lists).
- **Colleges:** NIRF 2025 ranks (or rank bands) from the official list. **Fees are approximate**:
  they vary by course and year.
- **Schools:** real schools; **fees are approximate**.
- **Food:** real restaurants; **cost for two is approximate**. Zomato blocks automated reading and
  other sites showed out-of-date prices.
- **Places:** real; entry fees for Lalbagh and Bangalore Palace checked on Karnataka Tourism.
  Bannerghatta, the science museum and Wonderla changed prices recently, so they say "Check before
  going". Other timings may be out of date.
- **Events:** dates from public listings (Oct 2026 onward).
- **Fares and flooding:** auto fares (₹36 for 2 km + ₹18/km, 1.5× at night, from Aug 2025); metro
  fare slabs (₹10–₹90, Feb 2025); flood spots from 2024–25 news reports.
- **Estimates:** travel times (area centres, average speeds, our rush-hour and rain multipliers),
  metro station positions (approximate, and the dataset predates the newest lines), commute minutes,
  monthly costs. Bus routes are a selection: check them in the BMTC app.

Each listing's page links to its source and the date it was checked. The tests in
`src/data/data.test.ts` fail if a rating is added to the data files or a PG, gym, rental or
showroom is missing its source.

Sources: [NIRF 2025](https://www.nirfindia.org/Rankings/2025/OverallRanking.html) ·
[Stanza Living](https://www.stanzaliving.com/bangalore/pg-near-christ-university) ·
[Royal Brothers tariff](https://www.royalbrothers.com/bangalore/bike-rentals/tariff) ·
[ONN Bikes](https://www.onnbikes.com/tariff/bengaluru) ·
[Revv](https://www.revv.co.in/car-rental/bangalore) ·
[Gold's Gym India](https://goldsgym.in/) ·
[Karnataka Tourism](https://karnatakatourism.org/) ·
[Auto fares, Aug 2025](https://thesouthfirst.com/karnataka/auto-fares-revised-in-bengaluru-effective-from-august-1/) ·
[Metro fares, Feb 2025](https://www.ibtimes.co.in/bengaluru-namma-metro-revises-ticket-prices-new-fares-range-rs-10-rs-90-details-879291) ·
[Flooding, May 2025](https://www.deccanherald.com/india/karnataka/bengaluru/flooding-in-many-parts-of-bengaluru-after-torrential-overnight-rain-3546886) ·
Station positions from [geohacker/namma-metro](https://github.com/geohacker/namma-metro) (MIT) ·
Map © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.

### Updating the data

Edit the JSON files in `src/data/` and restart the server. On start-up the server copies them into
the database and removes listings you deleted from the files (listings added through `/admin` are
kept). When you change a price, update `checked` to today's date.

## The GitHub Pages demo

`.github/workflows/pages.yml` builds the site on every push to `main` and publishes it to GitHub
Pages. GitHub Pages only serves files, so there is no Express server: the demo is built with
`VITE_DEMO=1`, which turns off reviews and admin (they show a short note instead) and asks search
engines not to list it. `VITE_BASE` makes links work under `/ooru-bengaluru-guide/`.

To try the demo build on your computer:

```bash
VITE_BASE=/ooru-bengaluru-guide/ VITE_DEMO=1 npm run build
```

## Deploying (later)

SQLite needs a disk that survives restarts, so pick a host with a persistent volume (Render,
Railway, Fly.io or a small VPS), set `ADMIN_TOKEN` (16+ characters), `DB_FILE` (on the volume)
and `TRUST_PROXY=1` (these hosts put a proxy in front of your server), and run `npm start`. For heavy traffic, swap OpenStreetMap's public tiles for a tile provider, per
OSM's usage policy.
