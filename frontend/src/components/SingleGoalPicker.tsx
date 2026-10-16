import { useEffect, useMemo, useState } from 'react'
import * as Select from '@radix-ui/react-select'
import { getGoals } from '../api/goalApi'
import type { Goal } from '../types/Goal'

type SingleGoalPickerProps = {
  readonly selectedId: number | null
  readonly onChange: (id: number | null) => void
  readonly disabled: boolean
}

const noGoalValue = 'none'

export default function SingleGoalPicker({ selectedId, onChange, disabled }: SingleGoalPickerProps) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  const selected = useMemo(
    () => goals.find(goal => goal.id === selectedId) ?? null,
    [goals, selectedId],
  )

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

  return <fieldset className="goal-form-picker" disabled={disabled}>
    <legend>Cel <span>(opcjonalnie)</span></legend>
    {loading && <p className="goal-form-picker-status" role="status">Ładowanie celów…</p>}
    {!loading && error && <div className="goal-form-picker-error">
      <p className="form-error" role="alert">{error}</p>
      <button type="button" className="secondary-button" onClick={() => {
        setLoading(true)
        setError('')
        setRetry(value => value + 1)
      }}>Spróbuj ponownie</button>
    </div>}
    {!loading && !error && <Select.Root
      value={selectedId === null ? noGoalValue : String(selectedId)}
      disabled={disabled}
      onValueChange={value => onChange(value === noGoalValue ? null : Number(value))}
    >
      <Select.Trigger className="category-select-trigger goal-select-trigger" aria-label="Wybierz cel">
        <span className="category-select-trigger-value">
          <Select.Value>{selected?.title ?? 'Bez celu'}</Select.Value>
        </span>
        <Select.Icon className="category-select-chevron">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="category-select-content goal-select-content" position="popper" sideOffset={4}
          collisionPadding={12}>
          <Select.Viewport className="category-select-viewport">
            <Select.Item className="category-select-item goal-select-item" value={noGoalValue}>
              <Select.ItemText>Bez celu</Select.ItemText>
              <Select.ItemIndicator className="category-select-indicator" aria-hidden="true">
                <svg viewBox="0 0 20 20"><path d="m4.5 10 3.5 3.5 7.5-8" /></svg>
              </Select.ItemIndicator>
            </Select.Item>
            {goals.map(goal => <Select.Item className="category-select-item goal-select-item" key={goal.id}
              value={String(goal.id)}>
              <Select.ItemText>{goal.title}</Select.ItemText>
              <Select.ItemIndicator className="category-select-indicator" aria-hidden="true">
                <svg viewBox="0 0 20 20"><path d="m4.5 10 3.5 3.5 7.5-8" /></svg>
              </Select.ItemIndicator>
            </Select.Item>)}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>}
  </fieldset>
}
