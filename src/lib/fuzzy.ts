// ---------------------------------------------------------------
// fuzzy.ts
// Typo tolerance for the search box.
//
// "Edit distance" (Levenshtein distance) = the fewest single-letter
// changes (insert, delete, replace) to turn one word into another.
//   gymm      -> gym        = 1 change (delete an m)
//   biriyani  -> biryani    = 1 change
//   resturant -> restaurant = 1 change
// It's a classic dynamic-programming algorithm (you'll see it in DAA).
// ---------------------------------------------------------------

// Returns the edit distance between a and b, but gives up early
// (returns max + 1) once it's clear the distance is bigger than `max`.
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1

  // prev[j] = distance between the first i-1 letters of a and first j letters of b
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1, // delete
        curr[j - 1] + 1, // insert
        prev[j - 1] + cost, // replace (or keep if same)
      )
      rowMin = Math.min(rowMin, curr[j])
    }
    if (rowMin > max) return max + 1 // every path is already too long
    prev = curr
  }
  return prev[b.length]
}

// How many typos we allow depends on word length:
// short words must be almost exact, long words can have 2 mistakes.
const allowedTypos = (word: string) => (word.length <= 7 ? 1 : 2)

// Find the closest known word. Returns the word itself if it's known,
// a corrected word if one is close enough, or null if nothing is close.
export function correctWord(word: string, vocabulary: Set<string>): string | null {
  if (vocabulary.has(word)) return word
  if (word.length < 4 || /\d/.test(word)) return null // too short / a number: don't guess

  const max = allowedTypos(word)
  let best: string | null = null
  let bestDistance = max + 1
  for (const known of vocabulary) {
    if (known.length < 3) continue
    const d = editDistance(word, known, max)
    if (d < bestDistance) {
      bestDistance = d
      best = known
      if (d === 1) break // good enough, stop looking
    }
  }
  return best
}
