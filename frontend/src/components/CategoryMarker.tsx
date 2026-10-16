import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { Category } from '../types/Category'
import CategoryIcon from './CategoryIcon'

export default function CategoryMarker({ category, className, embedded = false }: {
  readonly category: Category
  readonly className: string
  readonly embedded?: boolean
}) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()

  useEffect(() => {
    if (!open) return
    function close(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  function toggle(event: MouseEvent<HTMLSpanElement>) {
    event.preventDefault()
    event.stopPropagation()
    setOpen(value => !value)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      setOpen(value => !value)
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  return <span ref={container} className={`${className} category-marker${open ? ' category-marker-open' : ''}`}
    {...(!embedded ? { role: 'button', tabIndex: 0, 'aria-expanded': open } : {})}
    aria-label={`Kategoria: ${category.name}`} aria-describedby={open ? tooltipId : undefined}
    onClick={toggle} onKeyDown={!embedded ? handleKeyDown : undefined}>
    <CategoryIcon icon={category.icon} color={category.color} />
    <span id={tooltipId} className="category-marker-tooltip" role="tooltip">{category.name}</span>
  </span>
}

export function CategoryCardDetail({ category }: { readonly category: Category }) {
  return <p className="category-card-detail">
    <CategoryIcon icon={category.icon} color={category.color} />
    <span>Kategoria: <strong>{category.name}</strong></span>
  </p>
}
