// Sets the browser tab title for a page: usePageTitle('Day planner')
// -> "Day planner | Ooru". Helps people with many tabs, and search engines.
import { useEffect } from 'react'
import { SITE } from '../site'

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE.name}` : `${SITE.name} | ${SITE.tagline}`
  }, [title])
}
