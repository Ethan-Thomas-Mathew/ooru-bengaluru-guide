// Bookmark button: adds/removes an item from the Saved shortlist
import { useRef } from 'react'
import type { BaseItem } from '../../shared/types'
import { makeKey, toggleSaved, useSaved } from '../lib/saved'
import { pop } from '../lib/motion'

interface Props {
  categoryId: string
  item: BaseItem
  withLabel?: boolean
}

export default function SaveButton({ categoryId, item, withLabel = false }: Props) {
  const saved = useSaved()
  const key = makeKey(categoryId, item.id)
  const isSaved = saved.includes(key)
  const ref = useRef<HTMLButtonElement>(null)

  const onClick = () => {
    toggleSaved(key)
    pop(ref.current) // small bounce so you can see it worked
  }

  return (
    <button
      ref={ref}
      type="button"
      className={`icon-btn${isSaved ? ' is-on' : ''}${withLabel ? ' with-label' : ''}`}
      onClick={onClick}
      aria-pressed={isSaved}
      aria-label={withLabel ? undefined : `${isSaved ? 'Remove' : 'Save'} ${item.name}`}
      title={isSaved ? 'Saved' : 'Save to compare later'}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z"
          fill={isSaved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {withLabel && <span>{isSaved ? 'Saved' : 'Save'}</span>}
    </button>
  )
}
