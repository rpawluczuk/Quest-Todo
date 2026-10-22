import { useEffect, useId, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import type { Task } from '../types/Task'
import type { Category } from '../types/Category'
import TaskNoteField from './TaskNoteField'
import SingleGoalPicker from './SingleGoalPicker'
import CategoryPicker from './CategoryPicker'
import CategoryCreateForm from './CategoryCreateForm'
import DiscardTaskChangesDialog from './DiscardTaskChangesDialog'

type EditTaskFormProps = {
  readonly task: Task
  readonly onSave: (title: string, points: number, description: string, dueDate: string, dueTime: string,
    categoryId: number | null, goalId: number | null) => Promise<void>
  readonly onCancel: () => void
}

function EditTaskForm({ task, onSave, onCancel }: EditTaskFormProps) {
  const initialDueDate = task.dueDate ?? ''
  const initialDueTime = task.dueTime?.slice(0, 5) ?? ''
  const initialDescription = task.description ?? ''
  const initialGoalId = task.goalId ?? null
  const initialCategoryId = task.category?.id ?? null
  const [editTitle, setEditTitle] = useState(task.title)
  const [editPoints, setEditPoints] = useState(String(task.points))
  const [editDescription, setEditDescription] = useState(initialDescription)
  const [editDueDate, setEditDueDate] = useState(initialDueDate)
  const [editDueTime, setEditDueTime] = useState(initialDueTime)
  const [editGoalId, setEditGoalId] = useState<number | null>(initialGoalId)
  const [editCategoryId, setEditCategoryId] = useState<number | null>(initialCategoryId)
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; points?: string }>({})
  const [editError, setEditError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const [activeView, setActiveView] = useState<'task' | 'category'>('task')
  const [categorySaving, setCategorySaving] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleInput = useRef<HTMLInputElement>(null)
  const pointsInput = useRef<HTMLInputElement>(null)
  const dueDateInput = useRef<HTMLInputElement>(null)
  const titleErrorId = useId()
  const pointsErrorId = useId()
  const dialogTitleId = useId()
  const hasUnsavedChanges = editTitle !== task.title || editPoints !== String(task.points) ||
    editDescription !== initialDescription || editDueDate !== initialDueDate || editDueTime !== initialDueTime ||
    editGoalId !== initialGoalId || editCategoryId !== initialCategoryId

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  useEffect(() => {
    if (activeView === 'task') requestAnimationFrame(() => titleInput.current?.focus())
  }, [activeView])

  function requestClose() {
    if (isSaving) return
    if (hasUnsavedChanges) setDiscardDialogOpen(true)
    else onCancel()
  }

  function categoryCreated(category: Category) {
    setEditCategoryId(category.id)
    setActiveView('task')
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return
    const updatedTitle = editTitle.trim()
    const taskPoints = Number(editPoints)
    const errors: { title?: string; points?: string } = {}
    if (!updatedTitle) errors.title = 'Podaj nazwę zadania.'
    if (!editPoints.trim()) errors.points = 'Podaj liczbę punktów.'
    else if (!Number.isSafeInteger(taskPoints) || taskPoints <= 0) errors.points = 'Punkty muszą być dodatnią liczbą całkowitą.'
    else if (taskPoints > 1000) errors.points = 'Maksymalna liczba punktów za zadanie to 1000.'
    setFieldErrors(errors)
    setEditError('')
    if (errors.title || errors.points) {
      if (errors.title) titleInput.current?.focus()
      else pointsInput.current?.focus()
      return
    }
    setIsSaving(true)
    try {
      await onSave(updatedTitle, taskPoints, editDescription.trim(), editDueDate, editDueTime,
        editCategoryId, editGoalId)
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Nie udało się zapisać zmian. Spróbuj ponownie.')
    } finally {
      setIsSaving(false)
    }
  }

  return <>
    <dialog ref={dialog} className="password-dialog change-password-dialog create-task-dialog edit-task-dialog"
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
        <h2 id={dialogTitleId}>Edytuj zadanie</h2>
        <form className="task-form task-details-form" onSubmit={handleSubmit} noValidate>
          <label className="form-field">
            <span>Nazwa zadania <span className="required-field-marker" aria-hidden="true">*</span></span>
            <input ref={titleInput} type="text" disabled={isSaving} value={editTitle}
              onChange={event => { setEditTitle(event.target.value); if (fieldErrors.title) setFieldErrors(current => ({ ...current, title: undefined })) }}
              aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? titleErrorId : undefined} required />
            {fieldErrors.title && <span id={titleErrorId} className="field-error" role="alert">{fieldErrors.title}</span>}
          </label>
          <label className="form-field">
            <span>Punkty <span className="required-field-marker" aria-hidden="true">*</span></span>
            <input ref={pointsInput} type="number" disabled={isSaving} value={editPoints}
              onChange={event => { setEditPoints(event.target.value); if (fieldErrors.points) setFieldErrors(current => ({ ...current, points: undefined })) }}
              aria-invalid={Boolean(fieldErrors.points)} aria-describedby={fieldErrors.points ? pointsErrorId : undefined}
              min="1" max={1000} step="1" required />
            {fieldErrors.points && <span id={pointsErrorId} className="field-error" role="alert">{fieldErrors.points}</span>}
          </label>
          <CategoryPicker selectedId={editCategoryId} onChange={setEditCategoryId} disabled={isSaving}
            integratedCreateAction showOptionalLabel={false} onCreateRequest={() => setActiveView('category')} />
          <SingleGoalPicker selectedId={editGoalId} onChange={setEditGoalId} disabled={isSaving} />
          <fieldset className="task-due-field">
            <legend className="visually-hidden">Termin zadania</legend>
            <div className="task-due-inputs">
              <label className="form-field"><span>Termin</span>
                <input ref={dueDateInput} type="date" value={editDueDate} disabled={isSaving}
                  onChange={event => { setEditDueDate(event.target.value); if (!event.target.value) setEditDueTime('') }} />
              </label>
              <label className="form-field"><span>Godzina</span>
                <input type="time" value={editDueTime} disabled={isSaving || !editDueDate}
                  onChange={event => setEditDueTime(event.target.value)} />
              </label>
            </div>
            {editDueDate && <button type="button" className="task-due-clear" disabled={isSaving}
              onClick={() => { setEditDueDate(''); setEditDueTime(''); requestAnimationFrame(() => dueDateInput.current?.focus()) }}>
              Usuń termin
            </button>}
          </fieldset>
          <TaskNoteField value={editDescription} disabled={isSaving} initiallyExpanded={Boolean(initialDescription.trim())}
            onChange={event => setEditDescription(event.target.value)} />
          <div className="task-actions">
            <button type="submit" disabled={isSaving}>{isSaving ? 'Zapisywanie…' : 'Zapisz zmiany'}</button>
            <button type="button" className="secondary-button" onClick={requestClose} disabled={isSaving}>Anuluj</button>
          </div>
          {editError && <p className="form-error" role="alert">{editError}</p>}
        </form>
      </> : <>
        <div className="create-task-dialog-category-header">
          <button type="button" className="create-task-dialog-back" aria-label="Wróć do edycji zadania"
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
    </dialog>
    {discardDialogOpen && <DiscardTaskChangesDialog onContinue={() => setDiscardDialogOpen(false)} onDiscard={onCancel} />}
  </>
}

export default EditTaskForm
