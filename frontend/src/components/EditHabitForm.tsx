import { useEffect, useId, useMemo, useRef, useState, type SubmitEvent } from 'react'
import { Info } from 'lucide-react'
import { completionConditionsMessage } from '../habitBonus'
import { habitFormChanged, type HabitFormValues } from '../habitFormState'
import type { Category } from '../types/Category'
import type { Habit, HabitSchedule } from '../types/Habit'
import CategoryCreateForm from './CategoryCreateForm'
import CategoryPicker from './CategoryPicker'
import DiscardTaskChangesDialog from './DiscardTaskChangesDialog'
import GoalPicker from './GoalPicker'
import HabitAdditionalSettings from './HabitAdditionalSettings'
import HabitPointsField from './HabitPointsField'
import HabitTargetField from './HabitTargetField'

export default function EditHabitForm({ habit, onSave, onCancel }: {
  habit: Habit
  onSave: (name: string, targetDays: number, rewardPoints: number, description: string, schedule: HabitSchedule,
    categoryId: number | null, goalIds: number[]) => Promise<void>
  onCancel: () => void
}) {
  const initialTargetDays = habit.latestTarget?.targetDays ?? 7
  const initialDescription = habit.description ?? ''
  const initialCategoryId = habit.category?.id ?? null
  const initialGoalIds = habit.goalIds ?? []
  const initialSchedule = useMemo<HabitSchedule>(() => ({ startDate: habit.startDate, endDate: habit.endDate,
    completionLimit: habit.completionLimit, completionBonusPoints: habit.completionBonusPoints,
    requiredSuccessPercent: habit.requiredSuccessPercent }), [habit.startDate, habit.endDate, habit.completionLimit,
    habit.completionBonusPoints, habit.requiredSuccessPercent])
  const [name, setName] = useState(habit.name)
  const [targetDays, setTargetDays] = useState(initialTargetDays)
  const [rewardPoints, setRewardPoints] = useState(String(habit.rewardPoints))
  const [description, setDescription] = useState(initialDescription)
  const [schedule, setSchedule] = useState<HabitSchedule>(initialSchedule)
  const [goalIds, setGoalIds] = useState<number[]>(initialGoalIds)
  const [categoryId, setCategoryId] = useState<number | null>(initialCategoryId)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [categorySaving, setCategorySaving] = useState(false)
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const [activeView, setActiveView] = useState<'habit' | 'category'>('habit')
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const wasLocked = useRef(habit.completionBonusConditionsLocked)
  const dialogTitleId = useId()
  const conditionsLocked = habit.completionBonusConditionsLocked
  const currentValues: HabitFormValues = { name, targetDays, rewardPoints, description, schedule, categoryId, goalIds }
  const initialValues: HabitFormValues = { name: habit.name, targetDays: initialTargetDays,
    rewardPoints: String(habit.rewardPoints), description: initialDescription, schedule: initialSchedule,
    categoryId: initialCategoryId, goalIds: initialGoalIds }
  const hasUnsavedChanges = habitFormChanged(currentValues, initialValues)

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  useEffect(() => {
    if (activeView === 'habit') requestAnimationFrame(() => input.current?.focus())
  }, [activeView])

  useEffect(() => {
    if (!wasLocked.current && conditionsLocked) {
      // A 409 refresh can lock financial fields while allowed draft fields stay untouched.
      // oxlint-disable-next-line react/set-state-in-effect
      setSchedule(initialSchedule)
      if (habit.completionBonusTargetLocked) {
        // oxlint-disable-next-line react/set-state-in-effect
        setTargetDays(initialTargetDays)
      }
    }
    wasLocked.current = conditionsLocked
  }, [conditionsLocked, habit, initialSchedule, initialTargetDays])

  function requestClose() {
    if (saving) return
    if (hasUnsavedChanges) setDiscardDialogOpen(true)
    else onCancel()
  }

  function categoryCreated(category: Category) {
    setCategoryId(category.id)
    setActiveView('habit')
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const trimmedName = name.trim()
    if (!trimmedName) { setError('Wpisz nazwę nawyku.'); input.current?.focus(); return }
    if (trimmedName.length > 120) { setError('Nazwa nawyku może mieć maksymalnie 120 znaków.'); input.current?.focus(); return }
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

  return <>
    <dialog ref={dialog}
      className="password-dialog change-password-dialog create-task-dialog edit-task-dialog habit-form-dialog"
      aria-labelledby={dialogTitleId} onCancel={event => {
        event.preventDefault()
        if (activeView === 'category') {
          if (!categorySaving) setActiveView('habit')
        } else requestClose()
      }}>
      {activeView === 'habit' ? <>
        <button type="button" className="password-dialog-close" aria-label="Zamknij formularz"
          title="Zamknij formularz" disabled={saving} onClick={requestClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
        <h2 id={dialogTitleId}>Edytuj nawyk</h2>
        <form className="task-form habit-form habit-dialog-form edit-form" onSubmit={submit}>
          <label className="form-field habit-name-field">
            <span>
              Nazwa nawyku <span className="required-field-marker" aria-hidden="true">*</span>
            </span>
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
          <CategoryPicker selectedId={categoryId} onChange={setCategoryId} disabled={saving} showOptionalLabel={false}
            integratedCreateAction onCreateRequest={() => setActiveView('category')} />
          <GoalPicker selectedIds={goalIds} onChange={setGoalIds} disabled={saving} />
          <HabitAdditionalSettings description={description} schedule={schedule} disabled={saving}
            scheduleDisabled={saving || conditionsLocked} lockMessage={completionConditionsMessage(habit)}
            onDescriptionChange={setDescription} onScheduleChange={setSchedule} />
          <div className="task-actions habit-form-actions">
            <button type="submit" disabled={saving}>{saving ? 'Zapisywanie…' : 'Zapisz'}</button>
            <button type="button" className="secondary-button" disabled={saving} onClick={requestClose}>Anuluj</button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
      </> : <>
        <div className="create-task-dialog-category-header">
          <button type="button" className="create-task-dialog-back" aria-label="Wróć do edycji nawyku"
            title="Wróć" disabled={categorySaving} onClick={() => setActiveView('habit')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6M9 12h10" />
            </svg>
          </button>
          <h2 id={dialogTitleId}>Nowa kategoria</h2>
        </div>
        <CategoryCreateForm className="category-create-dialog-form" onCreated={categoryCreated}
          onCancel={() => setActiveView('habit')} onBusyChange={setCategorySaving} popoverAppearance />
      </>}
    </dialog>
    {discardDialogOpen && <DiscardTaskChangesDialog onContinue={() => setDiscardDialogOpen(false)}
      onDiscard={onCancel} />}
  </>
}
