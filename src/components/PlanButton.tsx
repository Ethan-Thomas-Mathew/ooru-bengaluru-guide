// "Add to day plan" button. Shows a tick once the place is in the plan.
import { useRef } from 'react'
import type { BaseItem, CategoryId } from '../../shared/types'
import { inPlan, togglePlanStop, usePlan } from '../lib/plan'
import { pop } from '../lib/motion'

interface Props {
  categoryId: CategoryId
  item: BaseItem
  withLabel?: boolean
}

export default function PlanButton({ categoryId, item, withLabel = false }: Props) {
  const plan = usePlan()
  const added = inPlan(plan, `${categoryId}:${item.id}`)
  const ref = useRef<HTMLButtonElement>(null)

  const onClick = () => {
    togglePlanStop(categoryId, item)
    pop(ref.current)
  }

  return (
    <button
      ref={ref}
      type="button"
      className={`icon-btn${added ? ' is-on' : ''}${withLabel ? ' with-label' : ''}`}
      onClick={onClick}
      aria-pressed={added}
      aria-label={withLabel ? undefined : `${added ? 'Remove' : 'Add'} ${item.name} ${added ? 'from' : 'to'} day plan`}
      title={added ? 'In your day plan' : 'Add to day plan'}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        {added ? (
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            {/* a little route: two dots joined by a path */}
            <circle cx="6" cy="18" r="2.4" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="18" cy="6" r="2.4" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
              d="M8.2 17h5.3a3 3 0 0 0 0-6h-3a3 3 0 0 1 0-6H16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
      {withLabel && <span>{added ? 'In day plan' : 'Add to day plan'}</span>}
    </button>
  )
}
