// ---------------------------------------------------------------
// Saved.jsx  (/saved)
// Your shortlist, grouped by category. Each group is a side-by-side
// table so you can compare, e.g., three PGs on rent, sharing and food.
// ---------------------------------------------------------------

import { Link } from 'react-router-dom'
import type { BaseItem } from '../../shared/types'
import { CATEGORIES, type Category } from '../data/categories'
import { makeKey, toggleSaved, useSaved } from '../lib/saved'
import Rating from '../components/Rating'
import { usePageTitle } from '../lib/usePageTitle'
import { useData } from '../lib/dataContext'
import { placeUrl } from '../lib/urls'

function CompareTable({ category, items }: { category: Category; items: BaseItem[] }) {
  // Use the first item's facts to get the row labels (all items share them)
  const rows = category.describe(items[0]).facts.map(([label]) => label)

  return (
    <div className="table-wrap compare">
      <table>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Detail</span>
            </th>
            {items.map((item) => (
              <th key={item.id} scope="col">
                <Link to={placeUrl(category.id, item)}>{item.name}</Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Area</th>
            {items.map((item) => (
              <td key={item.id}>{item.area}</td>
            ))}
          </tr>
          {items.some((i) => i.rating != null) && (
            <tr>
              <th scope="row">Rating</th>
              {items.map((item) => (
                <td key={item.id}>
                  <Rating item={item} categoryId={category.id} />
                </td>
              ))}
            </tr>
          )}
          {rows.map((label, r) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {items.map((item) => (
                <td key={item.id}>{category.describe(item).facts[r][1]}</td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row">
              <span className="sr-only">Remove</span>
            </th>
            {items.map((item) => (
              <td key={item.id}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => toggleSaved(makeKey(category.id, item.id))}
                >
                  Remove
                </button>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function Saved() {
  const saved = useSaved()
  useData() // re-render when fresh data arrives
  usePageTitle('Saved')

  // For each category, pick out the saved items
  const groups = CATEGORIES.map((category) => ({
    category,
    items: category.data.filter((item) => saved.includes(makeKey(category.id, item.id))),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="wrap page">
      <h1>Saved</h1>
      {groups.length === 0 ? (
        <div className="empty">
          <h2>Nothing saved yet</h2>
          <p className="muted">
            Tap the bookmark on any college, PG or gym to keep it here and compare them side by side.
          </p>
          <Link className="btn btn-primary" to="/explore/colleges">
            Browse colleges
          </Link>
        </div>
      ) : (
        <>
          <p className="muted">Saved on this device only. Clearing your browser data removes them.</p>
          {groups.map(({ category, items }) => (
            <section key={category.id} className="detail-section" aria-labelledby={`saved-${category.id}`}>
              <h2 id={`saved-${category.id}`}>
                {category.name} <span className="muted small">({items.length})</span>
              </h2>
              {items.length > 1 && (
                <p className="swipe-hint muted small">Swipe the table sideways to compare all {items.length}.</p>
              )}
              <CompareTable category={category} items={items} />
            </section>
          ))}
        </>
      )}
    </div>
  )
}
