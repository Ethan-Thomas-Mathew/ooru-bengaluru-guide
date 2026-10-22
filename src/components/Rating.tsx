// Star rating pill: the average of reviews posted on this site
// ("4.5 (3)"). Nothing is shown until someone has reviewed the place:
// we don't make up ratings.
import type { BaseItem } from '../../shared/types'
import { useData } from '../lib/dataContext'

export default function Rating({ item, categoryId }: { item: BaseItem; categoryId: string }) {
  const { reviews } = useData()
  const community = reviews[`${categoryId}:${item.id}`]
  if (!community) return null
  const value = community.average
  const label = `Rated ${value.toFixed(1)} out of 5 from ${community.count} review${community.count === 1 ? '' : 's'}`

  return (
    <span className="rating is-community" aria-label={label} title={label}>
      <svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true">
        <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9z" fill="currentColor" />
      </svg>
      {value.toFixed(1)}
      <span className="rating-count">({community.count})</span>
    </span>
  )
}
