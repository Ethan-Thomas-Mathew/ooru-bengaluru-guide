// Turn listings into map pins for <MapView> (skips ones with no known location)
import type { BaseItem } from '../../shared/types'
import type { MapPoint } from '../components/MapView'
import { pinFor } from './geo'
import { placeUrl } from './urls'
import { CATEGORY_COLORS } from './colors'

export function toPoints(categoryId: string, items: BaseItem[]): MapPoint[] {
  return items.flatMap((item) => {
    const pin = pinFor(item)
    return pin
      ? [
          {
            ...pin,
            label: item.name,
            sub: item.area,
            href: placeUrl(categoryId, item),
            color: CATEGORY_COLORS[categoryId],
          },
        ]
      : []
  })
}
