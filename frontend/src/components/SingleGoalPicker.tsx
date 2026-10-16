import { useEffect, useState } from 'react'
import { getGoals } from '../api/goalApi'
import type { Goal } from '../types/Goal'

type SingleGoalPickerProps = {
  readonly selectedId: number | null
  readonly onChange: (id: number | null) => void
  readonly disabled: boolean
}

export default function SingleGoalPicker({ selectedId, onChange, disabled }: SingleGoalPickerProps) {
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
    {!loading && !error && goals.length === 0 &&
      <p className="goal-form-picker-status">Nie masz jeszcze celów do przypięcia.</p>}
    {!loading && !error && goals.length > 0 && <div className="goal-form-options">
      <label className="goal-form-option">
        <input type="radio" name="task-goal" checked={selectedId === null} onChange={() => onChange(null)} />
        <span>Bez celu</span>
      </label>
      {goals.map(goal => <label key={goal.id} className="goal-form-option">
        <input type="radio" name="task-goal" checked={selectedId === goal.id}
          onChange={() => onChange(goal.id)} />
        <span>{goal.title}</span>
      </label>)}
    </div>}
  </fieldset>
}
