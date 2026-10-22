// ---------------------------------------------------------------
// search.ts
// The "brain" of the search box. It reads a sentence like
//   "girls pg near christ under 12000"
// and works out:
//   - which category it is about       -> PGs
//   - which filters to pre-select      -> For: Girls, Near: Christ University
//   - any price limit                  -> max rent 12000
//
// Steps, in order:
//   1. clean the text   (lowercase, "ulsoor" -> "halasuru")
//   2. fix typos        ("biriyani" -> "biryani", see fuzzy.ts)
//   3. is it a trip?    ("metro from A to B", "plan my day")
//   4. pick a category  (score each category by matching keywords)
//   5. pre-tick filters, price limit, rating, sort
//   6. keep leftover words ("christ") to rank matching names first
//
// It is NOT AI. It is keyword matching plus a typo fixer, which is how
// most websites' search boxes work. Easy to read and explain.
// ---------------------------------------------------------------

import type { BaseItem, CategoryId } from '../../shared/types'
import { CATEGORIES, getCategory, type Category } from '../data/categories'
import { emptyFilters, optionsFor, type FilterState } from './filters'
import { ALL_STATIONS, ALL_STOPS, matchPlace } from './transit'
import { AREAS, AREA_NAMES } from './geo'
import { correctWord } from './fuzzy'

// Words that carry no meaning for search ("show me the best ...")
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'in',
  'at',
  'on',
  'near',
  'nearby',
  'around',
  'close',
  'for',
  'of',
  'to',
  'and',
  'with',
  'me',
  'my',
  'show',
  'find',
  'list',
  'best',
  'top',
  'good',
  'great',
  'some',
  'any',
  'latest',
  'all',
  'i',
  'want',
  'need',
  'what',
  'are',
  'is',
  'which',
  'where',
  'can',
  'get',
  'go',
  'how',
  'do',
  'bangalore',
  'bengaluru',
  'blr',
  'search',
  'please',
  'place',
  'options',
  'under',
  'below',
  'less',
  'than',
  'within',
  'upto',
  'up',
  'max',
  'cheap',
  'cheapest',
  'budget',
  'affordable',
  'rated',
  'star',
  'stars',
  'above',
  'from',
  'by',
  'that',
  'this',
  'there',
  'here',
  'only',
  'open',
  'hours',
])

// Area nicknames: [nickname, real area name in lowercase]
const AREA_ALIASES: [string, string][] = AREA_NAMES.flatMap((name) =>
  AREAS[name].aliases.map((alias): [string, string] => [alias, name.toLowerCase()]),
)

// Escape characters like "." or "+" so they are safe inside a RegExp
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// true if `phrase` appears in `text` as a whole word/phrase.
// has("bca colleges", "bca") -> true,  has("abcab", "bca") -> false
export function has(text: string, phrase: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(phrase.toLowerCase())}($|[^a-z0-9])`).test(text)
}

// ---- Step 1: clean the text -------------------------------------
export function normalize(raw: string): string {
  let q = (raw || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9₹+.,'\s-]/g, ' ') // drop symbols like ? ! /
    .replace(/\s+/g, ' ')
    .trim()
  for (const [alias, real] of AREA_ALIASES) {
    if (has(q, alias)) q = q.replace(new RegExp(`\\b${escapeRegex(alias)}\\b`, 'g'), real)
  }
  return q
}

// ---- Step 2: fix typos -------------------------------------------
// Every word the site "knows". Built the first time someone searches,
// and rebuilt (resetSearchIndex) when new data arrives from the server.
let vocabulary: Set<string> | null = null
export const resetSearchIndex = () => {
  vocabulary = null
}

const aliasList = (aliases: Record<string, string[]> | string[] | undefined): string[] =>
  Array.isArray(aliases) ? aliases : Object.values(aliases ?? {}).flat()

function getVocabulary(): Set<string> {
  if (vocabulary) return vocabulary
  const words = new Set(STOPWORDS)
  const addText = (text: string) =>
    text
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .forEach((w) => w && words.add(w))
  for (const cat of CATEGORIES) {
    cat.keywords.forEach(addText)
    for (const f of cat.filters) {
      if (f.type === 'multi' || f.type === 'toggle') aliasList(f.aliases).forEach(addText)
      if (f.type === 'multi') optionsFor(cat, f).forEach(addText)
    }
    for (const item of cat.data) addText(item.name)
  }
  AREA_NAMES.forEach(addText)
  ;[...ALL_STATIONS, ...ALL_STOPS].forEach(addText)
  ;[
    'plan',
    'itinerary',
    'trip',
    'day',
    'route',
    'bus',
    'buses',
    'metro',
    'girls',
    'boys',
    'move',
    'fare',
    'auto',
    'kannada',
    'rain',
  ].forEach(addText)
  vocabulary = words
  return words
}

function fixTypos(q: string): { text: string; changed: boolean } {
  const vocab = getVocabulary()
  let changed = false
  const fixed = q.split(' ').map((word) => {
    const clean = word.replace(/[.,]/g, '')
    if (!clean || vocab.has(clean) || /\d/.test(clean)) return word
    const better = correctWord(clean, vocab)
    if (better && better !== clean) {
      changed = true
      return better
    }
    return word
  })
  return { text: fixed.join(' '), changed }
}

// ---- Step 3: trips and tools --------------------------------------
export type ParsedQuery =
  | { type: 'transit'; mode: 'metro' | 'bus'; from: string; to: string; corrected: string | null }
  | { type: 'page'; path: string; label: string; corrected: string | null }
  | {
      type: 'category'
      categoryId: CategoryId
      filters: FilterState
      sort: string
      words: string[]
      corrected: string | null
    }
  | { type: 'all'; words: string[]; corrected: string | null }

// "metro from A to B" style questions
function parseTransit(q: string): { mode: 'metro' | 'bus'; from: string; to: string } | null {
  if (!/\b(bus|buses|metro|route|routes|from|reach|travel|commute)\b/.test(q)) return null
  const mode = /\bmetro\b/.test(q) ? 'metro' : /\bbus(es)?\b/.test(q) ? 'bus' : 'metro'
  const cleaned = q
    .replace(/\b(how (do i|to|can i) (go|get|reach|travel)|which|bus(es)?|metro|routes?|take|by|from)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const parts = cleaned.split(/\s+to\s+/)
  if (parts.length !== 2) return null
  const list = mode === 'metro' ? ALL_STATIONS : ALL_STOPS
  return { mode, from: matchPlace(parts[0], list) ?? parts[0], to: matchPlace(parts[1], list) ?? parts[1] }
}

// Words that open one of the site's tools instead of a list
const TOOL_PAGES: [RegExp, string, string][] = [
  [/\b(itinerary|itinery|plan (my|a) (day|trip)|day plan(ner)?|day out|trip planner)\b/, '/plan', 'Day planner'],
  [
    /\b(move in|moving to|move-in|new to bangalore|relocat\w*|cost of living|monthly cost)\b/,
    '/move-in',
    'Move-in kit',
  ],
  [/\b(auto fare|auto rate|metro fare|fare calculator|kannada|phrase\w*|newcomer)\b/, '/newcomer', 'Newcomer pack'],
]

// ---- Step 4: which category does the sentence talk about? -------
function detectCategory(q: string): Category | null {
  let best: Category | null = null
  let bestScore = 0
  for (const cat of CATEGORIES) {
    let score = 0
    // Longer phrases ("paying guest") count more than short words ("pg")
    for (const word of cat.keywords) if (has(q, word)) score += 2 + word.split(' ').length
    // Filter aliases count a little too ("cbse" -> schools, "biryani" -> food)
    for (const f of cat.filters) {
      if (f.type !== 'multi') continue
      for (const list of Object.values(f.aliases ?? {})) if (list.some((a) => has(q, a))) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      best = cat
    }
  }
  return best
}

// Every word/phrase that "belongs" to a category (used to find leftovers)
function categoryTerms(cat: Category): string[] {
  const terms = [...cat.keywords]
  for (const f of cat.filters) {
    if (f.type === 'multi' || f.type === 'toggle') terms.push(...aliasList(f.aliases))
    if (f.type === 'multi') terms.push(...optionsFor(cat, f).map((o) => o.toLowerCase()))
  }
  return terms
}

// ---- Step 5: pre-select filters from the words used --------------
function presetFilters(cat: Category, q: string): FilterState {
  const state = emptyFilters(cat)
  for (const f of cat.filters) {
    if (f.type === 'multi') {
      for (const option of optionsFor(cat, f)) {
        const aliases = f.aliases?.[option] ?? []
        // Very short option names ("BE", "IB") only match through aliases,
        // otherwise every sentence with the word "be" would tick "BE".
        const plain = option.toLowerCase()
        const terms = plain.length > 2 && !f.aliasesOnly ? [plain, ...aliases] : aliases
        if (terms.some((t) => has(q, t))) (state[f.key] as string[]).push(option)
      }
    }
    if (f.type === 'toggle' && f.aliases?.some((a) => has(q, a))) state[f.key] = true
  }

  // Price limit: "under 10000", "below 5k", "less than ₹2,500"
  const price = q.match(/\b(under|below|less than|within|upto|up to|max)\s*₹?\s*([\d,]+)\s*(k)?\b/)
  if (price) {
    let amount = Number(price[2].replace(/,/g, ''))
    if (price[3]) amount *= 1000
    const maxFilter = cat.filters.find((f) => f.type === 'max')
    if (maxFilter) state[maxFilter.key] = amount
  }

  // Rating: "rated 4+" / "4 star"
  const rating = q.match(/\b([345](\.5)?)\s*(\+|star|stars|and above)/)
  if (rating) {
    const ratingFilter = cat.filters.find((f) => f.type === 'minRating')
    if (ratingFilter) state[ratingFilter.key] = Number(rating[1])
  }
  return state
}

// Pick a sort order from words like "cheap" or "top"
function presetSort(cat: Category, q: string): string {
  if (/\b(cheap|cheapest|budget|affordable|low cost|lowest)\b/.test(q)) {
    const priceSort = cat.sorts.find((s) => s.dir === 'asc' && !['nirf', 'date', 'commute'].includes(s.key))
    if (priceSort) return priceSort.key
  }
  if (/\b(short(est)? commute|closest|nearest)\b/.test(q) && cat.sorts.some((s) => s.key === 'commute'))
    return 'commute'
  if (/\b(top rated|highest rated|rated)\b/.test(q) && cat.sorts.some((s) => s.key === 'rating')) return 'rating'
  return cat.sorts[0].key
}

// ---- Step 6: words left over after removing everything we understood
function leftoverWords(q: string, cat: Category | null): string[] {
  let rest = q.replace(/₹?\d[\d,.]*k?\+?/g, ' ')
  const known = [...(cat ? categoryTerms(cat) : []), ...AREA_NAMES.map((a) => a.toLowerCase())]
  known.sort((a, b) => b.length - a.length) // remove "paying guest" before "guest"
  for (const term of known) {
    if (has(rest, term)) rest = rest.replace(new RegExp(`\\b${escapeRegex(term)}\\b`, 'g'), ' ')
  }
  return rest
    .split(/\s+/)
    .map((w) => w.replace(/[.,']/g, ''))
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
}

// ---------------------------------------------------------------
// MAIN EXPORT: parseQuery("bca colleges in jayanagar")
// ---------------------------------------------------------------
export function parseQuery(raw: string): ParsedQuery {
  const cleaned = normalize(raw)
  if (!cleaned) return { type: 'all', words: [], corrected: null }

  const { text: q, changed } = fixTypos(cleaned)
  const corrected = changed ? q : null

  for (const [re, path, label] of TOOL_PAGES) if (re.test(q)) return { type: 'page', path, label, corrected }

  const trip = parseTransit(q)
  if (trip) return { type: 'transit', ...trip, corrected }

  const cat = detectCategory(q)
  if (cat) {
    return {
      type: 'category',
      categoryId: cat.id,
      filters: presetFilters(cat, q),
      sort: presetSort(cat, q),
      words: leftoverWords(q, cat),
      corrected,
    }
  }

  // Just "metro" or "bus routes" with no category -> the bus and metro page
  if (/\b(metro|bus|buses)\b/.test(q)) {
    return { type: 'transit', mode: /\bmetro\b/.test(q) ? 'metro' : 'bus', from: '', to: '', corrected }
  }

  const words = q
    .split(/\s+/)
    .map((w) => w.replace(/[.,]/g, ''))
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
  return { type: 'all', words, corrected }
}

// ---------------------------------------------------------------
// RELEVANCE: how well does one item match some words?
//   word in the name        -> 5 points (7 if the name starts with it)
//   word is the item's area -> 3 points
//   word anywhere else      -> 1 point
// ---------------------------------------------------------------
export function relevance(item: BaseItem, words: string[]): number {
  const name = item.name.toLowerCase()
  const area = (item.area || '').toLowerCase()
  const rest = JSON.stringify(item).toLowerCase()
  let score = 0
  for (const w of words) {
    if (name.includes(w)) score += name.startsWith(w) ? 7 : 5
    else if (area.includes(w)) score += 3
    else if (rest.includes(w)) score += 1
  }
  return score
}

export interface ResultGroup {
  category: Category
  items: BaseItem[]
}

// Search every category at once (used when no category was detected).
// Items matching ALL words come first; if none do, items matching ANY word.
export function searchEverything(words: string[]): ResultGroup[] {
  if (!words.length) return []
  const scored = (mustMatchAll: boolean) =>
    CATEGORIES.map((category) => ({
      category,
      items: category.data
        .filter((item) => {
          const text = JSON.stringify(item).toLowerCase()
          return mustMatchAll ? words.every((w) => text.includes(w)) : words.some((w) => text.includes(w))
        })
        .sort((a, b) => relevance(b, words) - relevance(a, words)),
    }))
      .filter((g) => g.items.length > 0)
      .sort((a, b) => relevance(b.items[0], words) - relevance(a.items[0], words))

  const exact = scored(true)
  return exact.length ? exact : scored(false)
}

// A short sentence saying what we understood, shown under the search box
export function describeParse(parsed: ParsedQuery): string {
  switch (parsed.type) {
    case 'transit': {
      const how = parsed.mode === 'metro' ? 'Metro route' : 'Bus routes'
      return parsed.from && parsed.to ? `${how}: ${parsed.from} to ${parsed.to}` : `${how} finder`
    }
    case 'page':
      return parsed.label
    case 'category': {
      const cat = getCategory(parsed.categoryId)!
      const picked = Object.values(parsed.filters).filter(Array.isArray).flat()
      const toggles = cat.filters
        .filter((f) => f.type === 'toggle' && parsed.filters[f.key] === true)
        .map((f) => f.label)
      const all = [...picked, ...toggles]
      const extra = parsed.words.length ? ` matching "${parsed.words.join(' ')}"` : ''
      return (all.length ? `${cat.name}: ${all.join(', ')}` : cat.name) + extra
    }
    case 'all':
      return parsed.words.length ? `Everything matching "${parsed.words.join(' ')}"` : ''
  }
}

// ---------------------------------------------------------------
// SUGGESTIONS for the dropdown under the search box (autocomplete)
// ---------------------------------------------------------------
export type Suggestion =
  | { kind: 'place'; label: string; sub: string; categoryId: CategoryId; itemId: string }
  | { kind: 'category'; label: string; sub: string; categoryId: CategoryId }
  | { kind: 'area'; label: string; sub: string; query: string }

export function getSuggestions(raw: string): Suggestion[] {
  const q = normalize(raw)
  if (q.length < 2) return []
  const words = q.split(' ').filter((w) => w && !STOPWORDS.has(w))
  const last = q.split(' ').pop() ?? ''
  const out: Suggestion[] = []

  // 1. Listings whose name matches: each typed word must START a word in
  //    the name ("kora" matches "Koramangala", "ul" doesn't match "cult.fit")
  const items: { cat: Category; item: BaseItem; score: number }[] = []
  for (const cat of CATEGORIES) {
    for (const item of cat.data) {
      const nameWords = item.name.toLowerCase().split(/[^a-z0-9]+/)
      if (words.length && words.every((w) => nameWords.some((nw) => nw.startsWith(w)))) {
        items.push({ cat, item, score: relevance(item, words) })
      }
    }
  }
  items.sort((a, b) => b.score - a.score)
  for (const { cat, item } of items.slice(0, 4)) {
    out.push({ kind: 'place', label: item.name, sub: `${cat.name}, ${item.area}`, categoryId: cat.id, itemId: item.id })
  }

  // 2. Categories whose name or a keyword starts with the last word
  if (last.length >= 2) {
    for (const cat of CATEGORIES) {
      if (cat.name.toLowerCase().startsWith(last) || cat.keywords.some((k) => k.startsWith(last))) {
        out.push({ kind: 'category', label: cat.name, sub: cat.blurb, categoryId: cat.id })
      }
    }
  }

  // 3. Areas: "Everything in Koramangala"
  if (last.length >= 3) {
    for (const area of AREA_NAMES) {
      if (area === 'Bengaluru') continue
      if (area.toLowerCase().startsWith(last) || AREAS[area].aliases.some((a) => a.startsWith(last))) {
        out.push({ kind: 'area', label: `Everything in ${area}`, sub: 'Area', query: area })
      }
    }
  }

  // Remove duplicates by label and keep the list short
  const seen = new Set<string>()
  return out
    .filter((s) => {
      if (seen.has(s.label)) return false
      seen.add(s.label)
      return true
    })
    .slice(0, 7)
}
