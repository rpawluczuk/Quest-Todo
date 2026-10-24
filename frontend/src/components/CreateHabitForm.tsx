import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type SubmitEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Category } from '../types/Category'
import type { HabitSchedule } from '../types/Habit'
import { habitFormChanged, type HabitFormValues } from '../habitFormState'
import { habitToday } from '../weekDates'
import CategoryCreateForm from './CategoryCreateForm'
import CategoryPicker from './CategoryPicker'
import DiscardTaskChangesDialog from './DiscardTaskChangesDialog'
import GoalPicker from './GoalPicker'
import HabitAdditionalSettings from './HabitAdditionalSettings'
import HabitPointsField from './HabitPointsField'
import HabitTargetField from './HabitTargetField'

export type CreateHabitFormHandle = {
  open: (trigger?: HTMLButtonElement, initialGoalId?: number | null,
    onCreated?: (goalIds: number[]) => void) => void
}

function defaultSchedule(startDate: string): HabitSchedule {
  return { startDate, endDate: null, completionLimit: null, completionBonusPoints: null,
    requiredSuccessPercent: null }
}

const CreateHabitForm = forwardRef<CreateHabitFormHandle, {
  onAdd: (name: string, targetDays: number, rewardPoints: number, description: string, schedule: HabitSchedule,
    categoryId: number | null, goalIds: number[]) => Promise<void>
  onCreated?: () => void
}>(function CreateHabitForm({ onAdd, onCreated }, ref) {
  const [open, setOpen] = useState(false)
  const [activeView, setActiveView] = useState<'habit' | 'category'>('habit')
  const [initialStartDate, setInitialStartDate] = useState(() => habitToday())
  const [name, setName] = useState('')
  const [targetDays, setTargetDays] = useState(7)
  const [rewardPoints, setRewardPoints] = useState('1')
  const [description, setDescription] = useState('')
  const [schedule, setSchedule] = useState<HabitSchedule>(() => defaultSchedule(initialStartDate))
  const [goalIds, setGoalIds] = useState<number[]>([])
  const [initialGoalIds, setInitialGoalIds] = useState<number[]>([])
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [categorySaving, setCategorySaving] = useState(false)
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const wasOpen = useRef(false)
  const createdCallback = useRef<((goalIds: number[]) => void) | null>(null)
  const dialogTitleId = useId()

  const currentValues: HabitFormValues = { name, targetDays, rewardPoints, description, schedule, categoryId, goalIds }
  const initialValues: HabitFormValues = { name: '', targetDays: 7, rewardPoints: '1', description: '',
    schedule: defaultSchedule(initialStartDate), categoryId: null, goalIds: initialGoalIds }
  const hasUnsavedChanges = habitFormChanged(currentValues, initialValues)

  function resetForm(startDate = habitToday(), selectedGoalIds: number[] = []) {
    setInitialStartDate(startDate)
    setName('')
    setTargetDays(7)
    setRewardPoints('1')
    setDescription('')
    setSchedule(defaultSchedule(startDate))
    setGoalIds(selectedGoalIds)
    setInitialGoalIds(selectedGoalIds)
    setCategoryId(null)
    setError('')
    setActiveView('habit')
  }

  function closeForm() {
    resetForm()
    createdCallback.current = null
    setDiscardDialogOpen(false)
    setOpen(false)
  }

  function requestClose() {
    if (saving) return
    if (hasUnsavedChanges) setDiscardDialogOpen(true)
    else closeForm()
  }

  useImperativeHandle(ref, () => ({
    open(trigger, initialGoalId = null, onFormCreated) {
      const startDate = habitToday()
      returnFocus.current = trigger ?? null
      resetForm(startDate, initialGoalId === null ? [] : [initialGoalId])
      createdCallback.current = onFormCreated ?? null
      setOpen(true)
    },
  }), [])

  useEffect(() => {
    if (!open) return
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [open])

  useEffect(() => {
    if (open && activeView === 'habit') requestAnimationFrame(() => input.current?.focus())
    else if (!open && wasOpen.current) returnFocus.current?.focus()
    wasOpen.current = open
  }, [open, activeView])

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
      await onAdd(trimmedName, targetDays, Number(rewardPoints), description.trim(), schedule, categoryId, goalIds)
      onCreated?.()
      createdCallback.current?.(goalIds)
      closeForm()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się dodać nawyku.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    {open && createPortal(<dialog ref={dialog}
      className="password-dialog change-password-dialog create-task-dialog habit-form-dialog"
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
        <h2 id={dialogTitleId}>Nowy nawyk</h2>
        <form className="task-form habit-form habit-dialog-form" onSubmit={submit}>
          <label className="form-field habit-name-field">
            <span>
              Nazwa nawyku <span className="required-field-marker" aria-hidden="true">*</span>
            </span>
            <input ref={input} value={name} maxLength={120} disabled={saving}
              onChange={event => setName(event.target.value)} placeholder="Np. Przeczytać 10 stron" required />
          </label>
          <div className="habit-primary-settings">
            <HabitTargetField value={targetDays} onChange={setTargetDays} disabled={saving} />
            <HabitPointsField value={rewardPoints} onChange={setRewardPoints} disabled={saving} />
          </div>
          <CategoryPicker selectedId={categoryId} onChange={setCategoryId} disabled={saving} showOptionalLabel={false}
            integratedCreateAction onCreateRequest={() => setActiveView('category')} />
          <GoalPicker selectedIds={goalIds} onChange={setGoalIds} disabled={saving} />
          <HabitAdditionalSettings description={description} schedule={schedule} disabled={saving}
            onDescriptionChange={setDescription} onScheduleChange={setSchedule} />
          <div className="task-actions habit-form-actions">
            <button type="submit" disabled={saving}>{saving ? 'Zapisywanie…' : 'Zapisz'}</button>
            <button type="button" className="secondary-button" disabled={saving} onClick={requestClose}>Anuluj</button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
      </> : <>
        <div className="create-task-dialog-category-header">
          <button type="button" className="create-task-dialog-back" aria-label="Wróć do nowego nawyku"
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
    </dialog>, document.body)}
    {discardDialogOpen && createPortal(<DiscardTaskChangesDialog onContinue={() => setDiscardDialogOpen(false)}
      onDiscard={closeForm} />, document.body)}
  </>
})

export default CreateHabitForm
