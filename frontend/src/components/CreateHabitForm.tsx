import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import HabitScheduleFields from './HabitScheduleFields'
import type { HabitSchedule } from '../types/Habit'
import { habitToday } from '../weekDates'
import HabitTargetField from './HabitTargetField'
import HabitPointsField from './HabitPointsField'
import AutoResizeTextarea from './AutoResizeTextarea'

export default function CreateHabitForm({ onAdd, isFirstHabit = false }: {
  onAdd: (name: string, targetDays: number, rewardPoints: number, description: string, schedule: HabitSchedule) => Promise<void>
  isFirstHabit?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState('')
  const [targetDays, setTargetDays] = useState(7)
  const [rewardPoints, setRewardPoints] = useState('1')
  const [description, setDescription] = useState('')
  const [schedule, setSchedule] = useState<HabitSchedule>({ startDate: habitToday(), endDate: null, completionLimit: null })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const wasExpanded = useRef(false)

  useEffect(() => {
    if (expanded) input.current?.focus()
    else if (wasExpanded.current) trigger.current?.focus()
    wasExpanded.current = expanded
  }, [expanded])

  function cancel() {
    setRewardPoints('1')
    setTargetDays(7)
    setName('')
    setDescription('')
    setError('')
    setSchedule({ startDate: habitToday(), endDate: null, completionLimit: null })
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
      await onAdd(trimmedName, targetDays, Number(rewardPoints), description.trim(), schedule)
      setRewardPoints('1')
      setTargetDays(7)
      setName('')
      setDescription('')
      setSchedule({ startDate: habitToday(), endDate: null, completionLimit: null })
      setExpanded(false)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się dodać nawyku.')
    } finally {
      setSaving(false)
    }
  }

  return expanded ? <form className="task-form habit-form" onSubmit={submit}>
    <label className="form-field">
      <span>Nazwa nawyku</span>
      <input ref={input} value={name} maxLength={120} disabled={saving}
        onChange={event => setName(event.target.value)} placeholder="Np. Przeczytać 10 stron" required />
    </label>
    <HabitPointsField value={rewardPoints} onChange={setRewardPoints} disabled={saving} />
    <HabitTargetField value={targetDays} onChange={setTargetDays} disabled={saving} />
    <label className="form-field task-description-field">
      <span>Opis / notatki (opcjonalnie)</span>
      <AutoResizeTextarea value={description} disabled={saving} onChange={event => setDescription(event.target.value)} />
    </label>
    <HabitScheduleFields value={schedule} onChange={setSchedule} disabled={saving} />
    <div className="task-actions">
      <button type="submit" disabled={saving}>{saving ? 'Zapisywanie…' : 'Dodaj nawyk'}</button>
      <button type="button" className="secondary-button" disabled={saving} onClick={cancel}>Anuluj</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </form> : <button ref={trigger} type="button" className={`${isFirstHabit ? 'empty-state-primary-button' : 'secondary-button'} add-task-toggle`}
    onClick={() => setExpanded(true)}>{isFirstHabit ? '+ Dodaj pierwszy nawyk' : '+ Dodaj nawyk'}</button>
}
