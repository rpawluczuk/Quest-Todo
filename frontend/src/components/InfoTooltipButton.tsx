import { Info } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type TooltipPosition = { left: number; top: number }

export default function InfoTooltipButton({ message, className = '' }: {
  readonly message: string
  readonly className?: string
}) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [position, setPosition] = useState<TooltipPosition | null>(null)
  const [portalContainer, setPortalContainer] = useState<Element | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const tooltip = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()

  const close = useCallback(() => {
    setOpen(false)
    setPinned(false)
  }, [])

  const show = useCallback(() => {
    setPortalContainer(button.current?.closest('dialog') ?? document.body)
    setOpen(true)
  }, [])

  const updatePosition = useCallback(() => {
    if (!button.current || !tooltip.current) return
    const triggerRect = button.current.getBoundingClientRect()
    const tooltipRect = tooltip.current.getBoundingClientRect()
    const viewportPadding = 12
    const desiredLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
    const left = Math.min(Math.max(desiredLeft, viewportPadding),
      window.innerWidth - tooltipRect.width - viewportPadding)
    let top = triggerRect.top - tooltipRect.height - 8
    if (top < viewportPadding) top = triggerRect.bottom + 8
    top = Math.min(top, window.innerHeight - tooltipRect.height - viewportPadding)
    setPosition({ left, top })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [message, open, updatePosition])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (!button.current?.contains(event.target as Node)) close()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      close()
      button.current?.focus()
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [close, open, updatePosition])

  return <>
    <button ref={button} type="button" className={`field-info-button${className ? ` ${className}` : ''}`}
      aria-label={message} aria-expanded={open} aria-describedby={open ? tooltipId : undefined}
      onMouseEnter={show} onMouseLeave={() => { if (!pinned) setOpen(false) }}
      onFocus={show} onBlur={close}
      onClick={() => {
        const next = !pinned
        setPinned(next)
        if (next) show()
        else setOpen(false)
      }}>
      <Info size={18} strokeWidth={2} aria-hidden="true" />
    </button>
    {open && portalContainer && createPortal(<span ref={tooltip} id={tooltipId} className="field-info-tooltip" role="tooltip"
      style={position ? { left: position.left, top: position.top } : { visibility: 'hidden' }}>
      {message}
    </span>, portalContainer)}
  </>
}
