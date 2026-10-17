import { useEffect, useId, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import type { Task } from '../types/Task'
import AutoResizeTextarea from './AutoResizeTextarea'
import SingleGoalPicker from './SingleGoalPicker'
import CategoryPicker from './CategoryPicker'

type EditTaskFormProps = {
  readonly task: Task
  readonly onSave: (title: string, points: number, description: string, dueDate: string, dueTime: string,
    categoryId: number | null, goalId: number | null) => Promise<void>
  readonly onCancel: () => void
}

function EditTaskForm({ task, onSave, onCancel }: EditTaskFormProps) {
  const [editTitle, setEditTitle] = useState(task.title)
  const [editPoints, setEditPoints] = useState(String(task.points))
  const [editDescription, setEditDescription] = useState(task.description ?? '')
  const [editDueDate, setEditDueDate] = useState(task.dueDate ?? '')
  const [editDueTime, setEditDueTime] = useState(task.dueTime?.slice(0, 5) ?? '')
  const [editGoalId, setEditGoalId] = useState<number | null>(task.goalId ?? null)
  const [editCategoryId, setEditCategoryId] = useState<number | null>(task.category?.id ?? null)
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; points?: string }>({})
  const [editError, setEditError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const titleInput = useRef<HTMLInputElement>(null)
  const pointsInput = useRef<HTMLInputElement>(null)
  const dueDateInput = useRef<HTMLInputElement>(null)
  const dueTimeHintId = useId()
  const titleErrorId = useId()
  const pointsErrorId = useId()

  useEffect(() => { titleInput.current?.focus() }, [])

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return

    const updatedTitle = editTitle.trim()
    const taskPoints = Number(editPoints)
    const errors: { title?: string; points?: string } = {}

    if (!updatedTitle) errors.title = 'Podaj nazwę zadania.'
    if (!editPoints.trim()) errors.points = 'Podaj liczbę punktów.'
    else if (!Number.isSafeInteger(taskPoints) || taskPoints <= 0) {
      errors.points = 'Punkty muszą być dodatnią liczbą całkowitą.'
    } else if (taskPoints > 1000) errors.points = 'Maksymalna liczba punktów za zadanie to 1000.'

    setFieldErrors(errors)
    setEditError('')
    if (errors.title || errors.points) {
      if (errors.title) titleInput.current?.focus()
      else pointsInput.current?.focus()
      return
    }
    setIsSaving(true)
    setEditError('')
    try {
      await onSave(updatedTitle, taskPoints, editDescription.trim(), editDueDate, editDueTime,
        editCategoryId, editGoalId)
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Nie udało się zapisać zmian. Spróbuj ponownie.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="task-form task-details-form edit-form" onSubmit={handleSubmit} noValidate>
      <label className="form-field">
        <span>Nazwa zadania <span className="required-field-marker" aria-hidden="true">*</span></span>
        <input
          ref={titleInput}
          type="text"
          disabled={isSaving}
          value={editTitle}
          onChange={(event) => {
            setEditTitle(event.target.value)
            if (fieldErrors.title) setFieldErrors(current => ({ ...current, title: undefined }))
          }}
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
          value={editPoints}
          onChange={(event) => {
            setEditPoints(event.target.value)
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
      <CategoryPicker selectedId={editCategoryId} onChange={setEditCategoryId} disabled={isSaving}
        integratedCreateAction showOptionalLabel={false} />
      <SingleGoalPicker selectedId={editGoalId} onChange={setEditGoalId} disabled={isSaving} />
      <fieldset className="task-due-field">
        <legend>Termin</legend>
        <div className="task-due-inputs">
          <label className="form-field">
            <span>Data</span>
            <input ref={dueDateInput} type="date" value={editDueDate} disabled={isSaving}
              onChange={event => { setEditDueDate(event.target.value); if (!event.target.value) setEditDueTime('') }} />
          </label>
          <label className="form-field">
            <span>Godzina</span>
            <input type="time" value={editDueTime} disabled={isSaving || !editDueDate}
              aria-describedby={!editDueDate ? dueTimeHintId : undefined}
              onChange={event => setEditDueTime(event.target.value)} />
            {!editDueDate && <small id={dueTimeHintId} className="task-due-hint">Najpierw wybierz datę.</small>}
          </label>
        </div>
        {editDueDate && <button type="button" className="task-due-clear" disabled={isSaving}
          onClick={() => {
            setEditDueDate('')
            setEditDueTime('')
            requestAnimationFrame(() => dueDateInput.current?.focus())
          }}>Usuń termin</button>}
      </fieldset>
      <label className="form-field task-description-field">
        <span>Opis / notatki</span>
        <AutoResizeTextarea value={editDescription} disabled={isSaving}
          onChange={event => setEditDescription(event.target.value)} />
      </label>
      <div className="task-actions">
        <button type="submit" disabled={isSaving}>{isSaving ? 'Zapisywanie…' : 'Zapisz'}</button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>
          Anuluj
        </button>
      </div>
      {editError && <p className="form-error" role="alert">{editError}</p>}
    </form>
  )
}

export default EditTaskForm
