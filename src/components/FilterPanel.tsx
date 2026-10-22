// ---------------------------------------------------------------
// FilterPanel.tsx
// Draws the filters for a category from its config.
// It doesn't store anything itself: the parent (Results page) owns the
// filter state and passes `onChange` so we can update it.
// ---------------------------------------------------------------

import { optionsFor, maxFor, type FilterState } from '../lib/filters'
import type { Category } from '../data/categories'

interface Props {
  category: Category
  filters: FilterState
  onChange: (next: FilterState) => void
}

const RATING_OPTIONS = [0, 3, 3.5, 4, 4.5]

export default function FilterPanel({ category, filters, onChange }: Props) {
  // Update one filter key, keep the rest the same
  const set = (key: string, value: FilterState[string]) => onChange({ ...filters, [key]: value })

  // Tick/untick one checkbox option
  const toggleOption = (key: string, option: string) => {
    const current = filters[key] as string[]
    set(key, current.includes(option) ? current.filter((o) => o !== option) : [...current, option])
  }

  return (
    <div className="filters">
      {category.filters.map((f) => {
        if (f.type === 'multi') {
          const options = optionsFor(category, f)
          return (
            <fieldset key={f.key}>
              <legend>{f.label}</legend>
              {/* Long lists (like areas) scroll inside a small box */}
              <div className={options.length > 7 ? 'option-list scroll' : 'option-list'}>
                {options.map((option) => (
                  <label key={option} className="check">
                    <input
                      type="checkbox"
                      checked={(filters[f.key] as string[]).includes(option)}
                      onChange={() => toggleOption(f.key, option)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )
        }

        if (f.type === 'toggle') {
          return (
            <label key={f.key} className="check check-toggle">
              <input
                type="checkbox"
                checked={filters[f.key] as boolean}
                onChange={(e) => set(f.key, e.target.checked)}
              />
              <span>{f.label}</span>
            </label>
          )
        }

        if (f.type === 'minRating') {
          return (
            <fieldset key={f.key}>
              <legend>{f.label}</legend>
              <div className="segmented">
                {RATING_OPTIONS.map((r) => (
                  <button key={r} type="button" aria-pressed={filters[f.key] === r} onClick={() => set(f.key, r)}>
                    {r === 0 ? 'Any' : `${r}+`}
                  </button>
                ))}
              </div>
            </fieldset>
          )
        }

        if (f.type === 'max') {
          const max = maxFor(category, f)
          const current = Math.min(filters[f.key] as number, max)
          return (
            <fieldset key={f.key}>
              <legend>{f.label}</legend>
              <input
                type="range"
                min={0}
                max={max}
                step={f.step}
                value={current}
                onChange={(e) => set(f.key, Number(e.target.value))}
                aria-valuetext={f.format(current)}
              />
              <p className="range-value">Up to {f.format(current)}</p>
            </fieldset>
          )
        }
        return null
      })}
    </div>
  )
}
