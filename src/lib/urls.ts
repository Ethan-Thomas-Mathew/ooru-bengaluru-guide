import type { BaseItem } from '../../shared/types'

// Link to an item's own page, e.g. /place/colleges/c-christ
export const placeUrl = (categoryId: string, item: Pick<BaseItem, 'id'>) => `/place/${categoryId}/${item.id}`
