import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { getGoals } from '../api/goalApi'
import type { Goal } from '../types/Goal'

type GoalPickerProps = {
  readonly selectedIds: readonly number[]
  readonly onChange: (ids: number[]) => void
  readonly disabled: boolean
}

export default function GoalPicker({ selectedIds, onChange, disabled }: GoalPickerProps) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [open, setOpen] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({})
  const picker = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const firstOption = useRef<HTMLInputElement>(null)
  const listId = useId()

  const selectedGoals = useMemo(() => selectedIds
    .map(id => goals.find(goal => goal.id === id))
    .filter((goal): goal is Goal => goal !== undefined), [goals, selectedIds])
  const availableGoals = useMemo(() => goals.filter(goal => !goal.completed || selectedIds.includes(goal.id)),
    [goals, selectedIds])
  const fullSummary = selectedGoals.length === 0 ? 'Bez celów' : selectedGoals.map(goal => goal.title).join(', ')
  const firstTwo = selectedGoals.length >= 2 ? `${selectedGoals[0].title}, ${selectedGoals[1].title}` : ''
  const compactSummary = selectedGoals.length === 0
    ? { name: 'Bez celów', suffix: '' }
    : selectedGoals.length === 1
      ? { name: selectedGoals[0].title, suffix: '' }
      : selectedGoals.length === 2 && firstTwo.length <= 34
        ? { name: firstTwo, suffix: '' }
        : { name: selectedGoals[0].title, suffix: `+${selectedGoals.length - 1}` }

  const positionPopover = useCallback(() => {
    const bounds = trigger.current?.getBoundingClientRect()
    if (!bounds) return
    const viewportMargin = 12
    const triggerGap = 4
    const width = Math.min(bounds.width, window.innerWidth - viewportMargin * 2)
    const preferredHeight = Math.min(280, window.innerHeight * 0.45)
    const expectedHeight = Math.min(preferredHeight, Math.max(52, goals.length * 44 + 8))
    const roomBelow = window.innerHeight - bounds.bottom - viewportMargin
    const roomAbove = bounds.top - viewportMargin
    const openAbove = roomBelow < expectedHeight + triggerGap && roomAbove > roomBelow
    const availableHeight = Math.max(44, (openAbove ? roomAbove : roomBelow) - triggerGap)
    const maxHeight = Math.min(preferredHeight, availableHeight)
    const actualHeight = Math.min(expectedHeight, maxHeight)
    const top = openAbove ? bounds.top - actualHeight - triggerGap : bounds.bottom + triggerGap
    const left = Math.max(viewportMargin, Math.min(bounds.left, window.innerWidth - width - viewportMargin))
    setPopoverStyle({ top, left, width, maxHeight })
  }, [goals.length])

  useEffect(() => {
    const controller = new AbortController()
    getGoals(controller.signal).then(loaded => {
      if (!controller.signal.aborted) setGoals(loaded)
    }).catch(() => {
      if (!controller.signal.aborted) setError('Nie udało się pobrać celów.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [retry])

  useEffect(() => {
    if (!open) return

    function closeWhenOutside(event: PointerEvent | FocusEvent) {
      if (event.target instanceof Node && !picker.current?.contains(event.target)) setOpen(false)
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      trigger.current?.focus()
    }

    document.addEventListener('pointerdown', closeWhenOutside)
    document.addEventListener('focusin', closeWhenOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', positionPopover)
    window.addEventListener('scroll', positionPopover, true)
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside)
      document.removeEventListener('focusin', closeWhenOutside)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', positionPopover)
      window.removeEventListener('scroll', positionPopover, true)
    }
  }, [open, positionPopover])

  useEffect(() => {
    // The picker must not reopen with stale state if saving finishes with an error.
    // oxlint-disable-next-line react/set-state-in-effect
    if (disabled) setOpen(false)
  }, [disabled])

  function toggle(id: number, checked: boolean) {
    onChange(checked
      ? [...new Set([...selectedIds, id])]
      : selectedIds.filter(selectedId => selectedId !== id))
  }

  function toggleOpen() {
    if (!open) positionPopover()
    setOpen(value => !value)
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowDown') return
    event.preventDefault()
    if (!open) toggleOpen()
    requestAnimationFrame(() => firstOption.current?.focus())
  }

  return <fieldset className="goal-form-picker" disabled={disabled}>
    <legend>Cele</legend>
    {loading && <p className="goal-form-picker-status" role="status">Ładowanie celów…</p>}
    {!loading && error && <div className="goal-form-picker-error">
      <p className="form-error" role="alert">{error}</p>
      <button type="button" className="secondary-button" onClick={() => {
        setLoading(true)
        setError('')
        setRetry(value => value + 1)
      }}>Spróbuj ponownie</button>
    </div>}
    {!loading && !error && <div className="goal-multiselect" ref={picker}>
      <button ref={trigger} type="button" className="category-select-trigger goal-multiselect-trigger"
        aria-expanded={open} aria-controls={listId} aria-haspopup="dialog" title={fullSummary}
        onClick={toggleOpen} onKeyDown={handleTriggerKeyDown}>
        <span className="goal-multiselect-summary">
          <span className="goal-multiselect-summary-name">{compactSummary.name}</span>
          {compactSummary.suffix && <span className="goal-multiselect-summary-count">{compactSummary.suffix}</span>}
        </span>
        <span className="category-select-chevron" aria-hidden="true">
          <svg viewBox="0 0 20 20"><path d="m5 7.5 5 5 5-5" /></svg>
        </span>
      </button>
      {open && <div id={listId} className="goal-multiselect-popover"
        style={popoverStyle} role="dialog" aria-label="Wybierz cele">
        {availableGoals.length === 0
          ? <p className="goal-multiselect-empty">Nie masz jeszcze celów do przypięcia.</p>
          : availableGoals.map((goal, index) => {
            const checked = selectedIds.includes(goal.id)
            return <label key={goal.id} className={`goal-multiselect-option${checked ? ' selected' : ''}`}>
              <input ref={index === 0 ? firstOption : undefined} type="checkbox" checked={checked}
                onChange={event => toggle(goal.id, event.target.checked)} />
              <span>{goal.title}</span>
            </label>
          })}
      </div>}
    </div>}
  </fieldset>
}
