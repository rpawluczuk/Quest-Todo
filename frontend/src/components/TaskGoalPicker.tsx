import { useEffect, useState } from 'react'
import { getGoals } from '../api/goalApi'
import type { Goal } from '../types/Goal'

type TaskGoalPickerProps = {
  readonly selectedIds: readonly number[]
  readonly onChange: (ids: number[]) => void
  readonly disabled: boolean
}

export default function TaskGoalPicker({ selectedIds, onChange, disabled }: TaskGoalPickerProps) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

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

  function toggle(id: number, checked: boolean) {
    onChange(checked
      ? [...selectedIds, id]
      : selectedIds.filter(selectedId => selectedId !== id))
  }

  return <fieldset className="task-goal-picker" disabled={disabled}>
    <legend>Cele <span>(opcjonalnie)</span></legend>
    {loading && <p className="task-goal-picker-status" role="status">Ładowanie celów…</p>}
    {!loading && error && <div className="task-goal-picker-error">
      <p className="form-error" role="alert">{error}</p>
      <button type="button" className="secondary-button" onClick={() => {
        setLoading(true)
        setError('')
        setRetry(value => value + 1)
      }}>Spróbuj ponownie</button>
    </div>}
    {!loading && !error && goals.length === 0 &&
      <p className="task-goal-picker-status">Nie masz jeszcze celów do przypięcia.</p>}
    {!loading && !error && goals.length > 0 && <div className="task-goal-options">
      {goals.map(goal => <label key={goal.id} className="task-goal-option">
        <input type="checkbox" checked={selectedIds.includes(goal.id)}
          onChange={event => toggle(goal.id, event.target.checked)} />
        <span>{goal.title}</span>
      </label>)}
    </div>}
  </fieldset>
}
