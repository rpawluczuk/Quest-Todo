import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import type { Habit } from '../types/Habit'
import type { HabitSchedule } from '../types/Habit'
import HabitTargetField from './HabitTargetField'
import HabitPointsField from './HabitPointsField'
import HabitAdditionalSettings from './HabitAdditionalSettings'
import GoalPicker from './GoalPicker'
import CategoryPicker from './CategoryPicker'
import { completionConditionsMessage } from '../habitBonus'
import { Info } from 'lucide-react'

export default function EditHabitForm({ habit, onSave, onCancel }: {
  habit: Habit
  onSave: (name: string, targetDays: number, rewardPoints: number, description: string, schedule: HabitSchedule,
    categoryId: number | null, goalIds: number[]) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(habit.name)
  const [targetDays, setTargetDays] = useState(habit.latestTarget?.targetDays ?? 7)
  const [rewardPoints, setRewardPoints] = useState(String(habit.rewardPoints))
  const [description, setDescription] = useState(habit.description ?? '')
  const [schedule, setSchedule] = useState<HabitSchedule>({ startDate: habit.startDate, endDate: habit.endDate,
    completionLimit: habit.completionLimit, completionBonusPoints: habit.completionBonusPoints,
    requiredSuccessPercent: habit.requiredSuccessPercent })
  const [goalIds, setGoalIds] = useState<number[]>(habit.goalIds ?? [])
  const [categoryId, setCategoryId] = useState<number | null>(habit.category?.id ?? null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const wasLocked = useRef(habit.completionBonusConditionsLocked)
  const conditionsLocked = habit.completionBonusConditionsLocked
  const initialTargetDays = habit.latestTarget?.targetDays ?? 7

  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => {
    if (!wasLocked.current && conditionsLocked) {
      // A 409 refresh can lock financial fields while allowed draft fields stay untouched.
      // oxlint-disable-next-line react/set-state-in-effect
      setSchedule({ startDate: habit.startDate, endDate: habit.endDate,
        completionLimit: habit.completionLimit, completionBonusPoints: habit.completionBonusPoints,
        requiredSuccessPercent: habit.requiredSuccessPercent })
      if (habit.completionBonusTargetLocked) {
        // oxlint-disable-next-line react/set-state-in-effect
        setTargetDays(habit.latestTarget?.targetDays ?? 7)
      }
    }
    wasLocked.current = conditionsLocked
  }, [conditionsLocked, habit])

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const trimmedName = name.trim()
    if (!trimmedName) { setError('Wpisz nazwę nawyku.'); return }
    if (trimmedName.length > 120) { setError('Nazwa nawyku może mieć maksymalnie 120 znaków.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(trimmedName, targetDays, Number(rewardPoints), description.trim(), schedule, categoryId, goalIds)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się zapisać nawyku.')
    } finally {
      setSaving(false)
    }
  }

  return <form className="task-form habit-form edit-form" onSubmit={submit}>
    <label className="form-field habit-name-field">
      <span>Nazwa nawyku</span>
      <input ref={input} value={name} maxLength={120} disabled={saving}
        onChange={event => setName(event.target.value)} required />
    </label>
    <div className="habit-primary-settings">
      <HabitTargetField value={targetDays} onChange={setTargetDays}
        disabled={saving || habit.completionBonusTargetLocked} />
      <HabitPointsField value={rewardPoints} onChange={setRewardPoints} disabled={saving} />
      {targetDays !== initialTargetDays && <p className="habit-target-hint">
        <Info aria-hidden="true" />
        <span>Zmiana obowiązuje od poniedziałku bieżącego tygodnia.</span>
      </p>}
    </div>
    <CategoryPicker selectedId={categoryId} onChange={setCategoryId} disabled={saving} integratedCreateAction />
    <GoalPicker selectedIds={goalIds} onChange={setGoalIds} disabled={saving} />
    <HabitAdditionalSettings description={description} schedule={schedule} disabled={saving}
      scheduleDisabled={saving || conditionsLocked} lockMessage={completionConditionsMessage(habit)}
      onDescriptionChange={setDescription} onScheduleChange={setSchedule} />
    <div className="task-actions habit-form-actions">
      <button type="submit" disabled={saving}>{saving ? 'Zapisywanie…' : 'Zapisz'}</button>
      <button type="button" className="secondary-button" disabled={saving} onClick={onCancel}>Anuluj</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>
}
