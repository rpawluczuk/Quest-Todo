import { ChevronDown } from 'lucide-react'
import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react'

export default function GoalDefinitionText({ text, maxLines = 3 }: { text: string; maxLines?: 2 | 3 }) {
  const [expanded, setExpanded] = useState(false)
  const [canToggle, setCanToggle] = useState(false)
  const paragraph = useRef<HTMLParagraphElement>(null)
  const contentId = useId()

  const measure = useCallback(() => {
    const element = paragraph.current
    if (!element || element.getClientRects().length === 0) return
    const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight)
    const overflowing = Number.isFinite(lineHeight) && element.scrollHeight > lineHeight * maxLines + 1
    setCanToggle(overflowing)
    if (!overflowing) setExpanded(false)
  }, [maxLines])

  useLayoutEffect(() => {
    measure()
    const observer = new ResizeObserver(measure)
    if (paragraph.current) observer.observe(paragraph.current)
    return () => observer.disconnect()
  }, [measure, text])

  return <>
    <p ref={paragraph} id={contentId}
      className={canToggle && !expanded
        ? `goal-definition-text-clamped goal-definition-text-clamped-${maxLines}` : undefined}>{text}</p>
    {canToggle && <button type="button" className="goal-definition-expand" aria-expanded={expanded}
      aria-controls={contentId} onClick={() => setExpanded(current => !current)}>
      <span>{expanded ? 'Pokaż mniej' : 'Pokaż więcej'}</span>
      <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
    </button>}
  </>
}
