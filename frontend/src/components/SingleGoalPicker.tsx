import { useEffect, useMemo, useRef, useState } from 'react'
import { getGoals } from '../api/goalApi'
import type { Goal } from '../types/Goal'
import FormSelect, { FormSelectItem } from './FormSelect'

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
  const dropdownTrigger = useRef<HTMLButtonElement>(null)

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
    <legend>Cel</legend>
    {loading && <p className="goal-form-picker-status" role="status">Ładowanie celów…</p>}
    {!loading && error && <div className="goal-form-picker-error">
      <p className="form-error" role="alert">{error}</p>
      <button type="button" className="secondary-button" onClick={() => {
        setLoading(true)
        setError('')
        setRetry(value => value + 1)
      }}>Spróbuj ponownie</button>
    </div>}
    {!loading && !error && <FormSelect
      ref={dropdownTrigger}
      value={selectedId === null ? noGoalValue : String(selectedId)}
      disabled={disabled}
      ariaLabel="Wybierz cel"
      triggerClassName="goal-select-trigger"
      contentClassName="goal-select-content"
      triggerContent={<span>{selected?.title ?? 'Bez celu'}</span>}
      onValueChange={value => onChange(value === noGoalValue ? null : Number(value))}
    >
      <FormSelectItem className="goal-select-item" value={noGoalValue}>Bez celu</FormSelectItem>
      {goals.map(goal => <FormSelectItem className="goal-select-item" key={goal.id} value={String(goal.id)}>
        {goal.title}
      </FormSelectItem>)}
    </FormSelect>}
  </fieldset>
}
