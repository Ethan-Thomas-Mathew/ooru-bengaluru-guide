// One row in the results list. The category decides what to show
// through its describe() function (see data/categories.ts).

import { Link } from 'react-router-dom'
import type { BaseItem } from '../../shared/types'
import type { Category } from '../data/categories'
import SaveButton from './SaveButton'
import PlanButton from './PlanButton'
import Rating from './Rating'
import { placeUrl } from '../lib/urls'
import { useRainMode } from '../lib/prefs'
import { OUTDOOR_KINDS, FLOOD_AREAS } from '../lib/traffic'

export default function ResultCard({ item, category }: { item: BaseItem; category: Category }) {
  const info = category.describe(item)
  const rain = useRainMode()
  const kind = (item as BaseItem & { kind?: string }).kind
  const rainWarning = rain && ((kind && OUTDOOR_KINDS.has(kind)) || FLOOD_AREAS.has(item.area))

  return (
    <li className="result-card">
      <div className="result-head">
        <h3>
          <Link to={placeUrl(category.id, item)}>{item.name}</Link>
        </h3>
        <div className="result-actions">
          <Rating item={item} categoryId={category.id} />
          <PlanButton categoryId={category.id} item={item} />
          <SaveButton categoryId={category.id} item={item} />
        </div>
      </div>
      <p className="result-sub">{info.subtitle}</p>

      {/* Key facts as label/value pairs */}
      <dl className="result-facts">
        {info.facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        {item.nearestMetro && category.id !== 'events' && (
          <div>
            <dt>Metro</dt>
            <dd>
              {item.nearestMetro}, {item.metroWalkMins} min walk
            </dd>
          </div>
        )}
      </dl>

      {(info.tags.length > 0 || rainWarning) && (
        <ul className="tags" aria-label="Details">
          {rainWarning && (
            <li className="tag-rain">{kind && OUTDOOR_KINDS.has(kind) ? 'Outdoors' : 'Waterlogging nearby'}</li>
          )}
          {info.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </li>
  )
}
