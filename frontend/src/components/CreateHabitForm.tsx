import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type SubmitEvent } from 'react'
import type { HabitSchedule } from '../types/Habit'
import { habitToday } from '../weekDates'
import HabitTargetField from './HabitTargetField'
import HabitPointsField from './HabitPointsField'
import HabitAdditionalSettings from './HabitAdditionalSettings'
import GoalPicker from './GoalPicker'
import CategoryPicker from './CategoryPicker'

export type CreateHabitFormHandle = {
  open: (trigger?: HTMLButtonElement) => void
}

const CreateHabitForm = forwardRef<CreateHabitFormHandle, {
  onAdd: (name: string, targetDays: number, rewardPoints: number, description: string, schedule: HabitSchedule,
    categoryId: number | null, goalIds: number[]) => Promise<void>
}>(function CreateHabitForm({ onAdd }, ref) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState('')
  const [targetDays, setTargetDays] = useState(7)
  const [rewardPoints, setRewardPoints] = useState('1')
  const [description, setDescription] = useState('')
  const [schedule, setSchedule] = useState<HabitSchedule>({ startDate: habitToday(), endDate: null, completionLimit: null,
    completionBonusPoints: null, requiredSuccessPercent: null })
  const [goalIds, setGoalIds] = useState<number[]>([])
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const wasExpanded = useRef(false)

  useEffect(() => {
    if (expanded) input.current?.focus()
    else if (wasExpanded.current) returnFocus.current?.focus()
    wasExpanded.current = expanded
  }, [expanded])

  useImperativeHandle(ref, () => ({
    open(button) {
      returnFocus.current = button ?? null
      setExpanded(true)
    },
  }), [])

  function cancel() {
    setRewardPoints('1')
    setTargetDays(7)
    setName('')
    setDescription('')
    setError('')
    setSchedule({ startDate: habitToday(), endDate: null, completionLimit: null,
      completionBonusPoints: null, requiredSuccessPercent: null })
    setGoalIds([])
    setCategoryId(null)
    setExpanded(false)
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const trimmedName = name.trim()
    if (!trimmedName) { setError('Wpisz nazwę nawyku.'); return }
    if (trimmedName.length > 120) { setError('Nazwa nawyku może mieć maksymalnie 120 znaków.'); return }
    setSaving(true)
    setError('')
    try {
      await onAdd(trimmedName, targetDays, Number(rewardPoints), description.trim(), schedule, categoryId, goalIds)
      setRewardPoints('1')
      setTargetDays(7)
      setName('')
      setDescription('')
      setSchedule({ startDate: habitToday(), endDate: null, completionLimit: null,
        completionBonusPoints: null, requiredSuccessPercent: null })
      setGoalIds([])
      setCategoryId(null)
      setExpanded(false)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się dodać nawyku.')
    } finally {
      setSaving(false)
    }
  }

  return expanded ? <form className="task-form habit-form" onSubmit={submit}>
    <label className="form-field habit-name-field">
      <span>Nazwa nawyku</span>
      <input ref={input} value={name} maxLength={120} disabled={saving}
        onChange={event => setName(event.target.value)} placeholder="Np. Przeczytać 10 stron" required />
    </label>
    <HabitTargetField value={targetDays} onChange={setTargetDays} disabled={saving} />
    <HabitPointsField value={rewardPoints} onChange={setRewardPoints} disabled={saving} />
    <CategoryPicker selectedId={categoryId} onChange={setCategoryId} disabled={saving} integratedCreateAction />
    <GoalPicker selectedIds={goalIds} onChange={setGoalIds} disabled={saving} />
    <HabitAdditionalSettings description={description} schedule={schedule} disabled={saving}
      onDescriptionChange={setDescription} onScheduleChange={setSchedule} />
    <div className="task-actions habit-form-actions">
      <button type="submit" disabled={saving}>{saving ? 'Zapisywanie…' : 'Dodaj nawyk'}</button>
      <button type="button" className="secondary-button" disabled={saving} onClick={cancel}>Anuluj</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </form> : null
})

export default CreateHabitForm
