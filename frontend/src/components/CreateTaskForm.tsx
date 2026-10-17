import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import TaskNoteField from './TaskNoteField'
import SingleGoalPicker from './SingleGoalPicker'
import CategoryPicker from './CategoryPicker'
import DiscardTaskChangesDialog from './DiscardTaskChangesDialog'
import CategoryCreateForm from './CategoryCreateForm'
import type { Category } from '../types/Category'

type CreateTaskFormProps = {
  readonly onAddTask: (title: string, points: number, description: string, dueDate: string, dueTime: string,
    categoryId: number | null, goalId: number | null, inFocus: boolean) => Promise<void>
  readonly isFirstTask?: boolean
  readonly hideTrigger?: boolean
}

export type CreateTaskFormHandle = {
  readonly open: (trigger?: HTMLButtonElement, targetList?: 'focus' | 'backlog') => void
}

const CreateTaskForm = forwardRef<CreateTaskFormHandle, CreateTaskFormProps>(function CreateTaskForm(
  { onAddTask, isFirstTask = false, hideTrigger = false },
  ref,
) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [targetList, setTargetList] = useState<'focus' | 'backlog'>('backlog')
  const [newTitle, setNewTitle] = useState('')
  const [newPoints, setNewPoints] = useState('10')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [goalId, setGoalId] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; points?: string }>({})
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const [activeView, setActiveView] = useState<'task' | 'category'>('task')
  const [categorySaving, setCategorySaving] = useState(false)
  const addButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleInput = useRef<HTMLInputElement>(null)
  const pointsInput = useRef<HTMLInputElement>(null)
  const dueDateInput = useRef<HTMLInputElement>(null)
  const wasExpanded = useRef(false)
  const titleErrorId = useId()
  const pointsErrorId = useId()
  const dialogTitleId = useId()

  const hasUnsavedChanges = newTitle !== '' || newPoints !== '10' || description !== '' || dueDate !== '' ||
    dueTime !== '' || goalId !== null || categoryId !== null

  function resetForm() {
    setNewTitle('')
    setNewPoints('10')
    setDescription('')
    setDueDate('')
    setDueTime('')
    setGoalId(null)
    setCategoryId(null)
    setFieldErrors({})
    setFormError('')
    setActiveView('task')
  }

  function closeForm() {
    resetForm()
    setDiscardDialogOpen(false)
    setIsExpanded(false)
  }

  function requestClose() {
    if (isSaving) return
    if (hasUnsavedChanges) setDiscardDialogOpen(true)
    else closeForm()
  }

  useImperativeHandle(ref, () => ({
    open(trigger, target = 'backlog') {
      setTargetList(target)
      returnFocus.current = trigger ?? null
      setActiveView('task')
      setIsExpanded(true)
    },
  }), [])

  useEffect(() => {
    if (!isExpanded) return
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [isExpanded])

  useEffect(() => {
    if (isExpanded && activeView === 'task') requestAnimationFrame(() => titleInput.current?.focus())
    else if (!isExpanded && wasExpanded.current) (returnFocus.current ?? addButton.current)?.focus()
    wasExpanded.current = isExpanded
  }, [isExpanded, activeView])

  function categoryCreated(category: Category) {
    setCategoryId(category.id)
    setActiveView('task')
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return

    const title = newTitle.trim()
    const taskPoints = Number(newPoints)
    const errors: { title?: string; points?: string } = {}

    if (!title) errors.title = 'Podaj nazwę zadania.'
    if (!newPoints.trim()) errors.points = 'Podaj liczbę punktów.'
    else if (!Number.isSafeInteger(taskPoints) || taskPoints <= 0) {
      errors.points = 'Punkty muszą być dodatnią liczbą całkowitą.'
    } else if (taskPoints > 1000) errors.points = 'Maksymalna liczba punktów to 1000.'

    setFieldErrors(errors)
    setFormError('')
    if (errors.title || errors.points) {
      if (errors.title) titleInput.current?.focus()
      else pointsInput.current?.focus()
      return
    }

    setIsSaving(true)
    setFormError('')
    try {
      await onAddTask(title, taskPoints, description.trim(), dueDate, dueTime, categoryId, goalId, targetList === 'focus')
      closeForm()
    } catch {
      setFormError('Nie udało się zapisać zadania. Sprawdź połączenie z backendem i spróbuj ponownie.')
    } finally {
      setIsSaving(false)
    }
  }

  return <>
    {isExpanded && <dialog ref={dialog} className="password-dialog change-password-dialog create-task-dialog"
      aria-labelledby={dialogTitleId} onCancel={event => {
        event.preventDefault()
        if (activeView === 'category') {
          if (!categorySaving) setActiveView('task')
        } else requestClose()
      }}>
      {activeView === 'task' ? <>
        <button type="button" className="password-dialog-close" aria-label="Zamknij formularz"
          title="Zamknij formularz" disabled={isSaving} onClick={requestClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
        <h2 id={dialogTitleId}>{targetList === 'focus' ? 'Nowy priorytet' : 'Nowe zadanie'}</h2>
      <form id="create-task-form" className="task-form task-details-form" onSubmit={handleSubmit}
        noValidate>
      <label className="form-field">
        <span>Nazwa zadania <span className="required-field-marker" aria-hidden="true">*</span></span>
        <input
          ref={titleInput}
          type="text"
          disabled={isSaving}
          value={newTitle}
          onChange={(event) => {
            setNewTitle(event.target.value)
            if (fieldErrors.title) setFieldErrors(current => ({ ...current, title: undefined }))
          }}
          placeholder="Co chcesz zrobić?"
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={fieldErrors.title ? titleErrorId : undefined}
          required
        />
        {fieldErrors.title && <span id={titleErrorId} className="field-error" role="alert">{fieldErrors.title}</span>}
      </label>
      <label className="form-field">
        <span>Punkty <span className="required-field-marker" aria-hidden="true">*</span></span>
        <input
          ref={pointsInput}
          type="number"
          disabled={isSaving}
          value={newPoints}
          onChange={(event) => {
            setNewPoints(event.target.value)
            if (fieldErrors.points) setFieldErrors(current => ({ ...current, points: undefined }))
          }}
          aria-invalid={Boolean(fieldErrors.points)}
          aria-describedby={fieldErrors.points ? pointsErrorId : undefined}
          min="1"
          max={1000}
          step="1"
          required
        />
        {fieldErrors.points && <span id={pointsErrorId} className="field-error" role="alert">{fieldErrors.points}</span>}
      </label>
      <CategoryPicker selectedId={categoryId} onChange={setCategoryId} disabled={isSaving}
        integratedCreateAction showOptionalLabel={false} onCreateRequest={() => setActiveView('category')} />
      <SingleGoalPicker selectedId={goalId} onChange={setGoalId} disabled={isSaving} />
      <fieldset className="task-due-field">
        <legend className="visually-hidden">Termin zadania</legend>
        <div className="task-due-inputs">
          <label className="form-field">
            <span>Termin</span>
            <input ref={dueDateInput} type="date" value={dueDate} disabled={isSaving}
              onChange={event => { setDueDate(event.target.value); if (!event.target.value) setDueTime('') }} />
          </label>
          <label className="form-field">
            <span>Godzina</span>
            <input type="time" value={dueTime} disabled={isSaving || !dueDate}
              onChange={event => setDueTime(event.target.value)} />
          </label>
        </div>
        {dueDate && <button type="button" className="task-due-clear" disabled={isSaving}
          onClick={() => {
            setDueDate('')
            setDueTime('')
            requestAnimationFrame(() => dueDateInput.current?.focus())
          }}>Usuń termin</button>}
      </fieldset>
      <TaskNoteField value={description} disabled={isSaving} initiallyExpanded={Boolean(description.trim())}
        onChange={event => setDescription(event.target.value)} />
      <div className="task-actions">
        <button type="submit" disabled={isSaving}>{isSaving ? 'Zapisywanie…' : targetList === 'focus' ? 'Dodaj do priorytetów' : 'Dodaj zadanie'}</button>
        <button type="button" className="secondary-button" disabled={isSaving} onClick={requestClose}>Anuluj</button>
      </div>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      </form>
      </> : <>
        <div className="create-task-dialog-category-header">
          <button type="button" className="create-task-dialog-back" aria-label="Wróć do nowego zadania"
            title="Wróć" disabled={categorySaving} onClick={() => setActiveView('task')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6M9 12h10" />
            </svg>
          </button>
          <h2 id={dialogTitleId}>Nowa kategoria</h2>
        </div>
        <CategoryCreateForm className="category-create-dialog-form" onCreated={categoryCreated}
          onCancel={() => setActiveView('task')} onBusyChange={setCategorySaving} popoverAppearance />
      </>}
    </dialog>}
    {!isExpanded && !hideTrigger && <button ref={addButton} type="button"
      className={`${isFirstTask ? 'empty-state-primary-button' : 'secondary-button'} add-task-toggle`}
      onClick={(event) => {
        returnFocus.current = event.currentTarget
        setTargetList('backlog')
        setActiveView('task')
        setIsExpanded(true)
      }}>
      {isFirstTask ? '+ Dodaj pierwsze zadanie' : '+ Dodaj zadanie'}
    </button>}
    {discardDialogOpen && <DiscardTaskChangesDialog onContinue={() => setDiscardDialogOpen(false)}
      onDiscard={closeForm} />}
  </>
})

export default CreateTaskForm
