import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import AutoResizeTextarea from './AutoResizeTextarea'
import SingleGoalPicker from './SingleGoalPicker'
import CategoryPicker from './CategoryPicker'

type CreateTaskFormProps = {
  readonly onAddTask: (title: string, points: number, description: string, dueDate: string, dueTime: string,
    categoryId: number | null, goalId: number | null) => Promise<void>
  readonly isFirstTask?: boolean
  readonly hideTrigger?: boolean
}

export type CreateTaskFormHandle = {
  readonly open: (trigger?: HTMLButtonElement) => void
}

const CreateTaskForm = forwardRef<CreateTaskFormHandle, CreateTaskFormProps>(function CreateTaskForm(
  { onAddTask, isFirstTask = false, hideTrigger = false },
  ref,
) {
  const [isExpanded, setIsExpanded] = useState(false)
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
  const addButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  const titleInput = useRef<HTMLInputElement>(null)
  const pointsInput = useRef<HTMLInputElement>(null)
  const dueDateInput = useRef<HTMLInputElement>(null)
  const wasExpanded = useRef(false)
  const dueTimeHintId = useId()
  const titleErrorId = useId()
  const pointsErrorId = useId()

  useImperativeHandle(ref, () => ({
    open(trigger) {
      returnFocus.current = trigger ?? null
      if (isExpanded) titleInput.current?.focus()
      else setIsExpanded(true)
    },
  }), [isExpanded])

  useEffect(() => {
    if (isExpanded) titleInput.current?.focus()
    else if (wasExpanded.current) (returnFocus.current ?? addButton.current)?.focus()
    wasExpanded.current = isExpanded
  }, [isExpanded])

  function cancel() {
    setNewTitle('')
    setNewPoints('10')
    setDescription('')
    setDueDate('')
    setDueTime('')
    setGoalId(null)
    setCategoryId(null)
    setFieldErrors({})
    setFormError('')
    setIsExpanded(false)
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
      await onAddTask(title, taskPoints, description.trim(), dueDate, dueTime, categoryId, goalId)
      setNewTitle('')
      setNewPoints('10')
      setDescription('')
      setDueDate('')
      setDueTime('')
      setGoalId(null)
      setCategoryId(null)
      setFieldErrors({})
      setIsExpanded(false)
    } catch {
      setFormError('Nie udało się zapisać zadania. Sprawdź połączenie z backendem i spróbuj ponownie.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    isExpanded ? <form id="create-task-form" className="task-form task-details-form" onSubmit={handleSubmit} noValidate>
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
        integratedCreateAction showOptionalLabel={false} />
      <SingleGoalPicker selectedId={goalId} onChange={setGoalId} disabled={isSaving} />
      <fieldset className="task-due-field">
        <legend>Termin</legend>
        <div className="task-due-inputs">
          <label className="form-field">
            <span>Data</span>
            <input ref={dueDateInput} type="date" value={dueDate} disabled={isSaving}
              onChange={event => { setDueDate(event.target.value); if (!event.target.value) setDueTime('') }} />
          </label>
          <label className="form-field">
            <span>Godzina</span>
            <input type="time" value={dueTime} disabled={isSaving || !dueDate}
              aria-describedby={!dueDate ? dueTimeHintId : undefined}
              onChange={event => setDueTime(event.target.value)} />
            {!dueDate && <small id={dueTimeHintId} className="task-due-hint">Najpierw wybierz datę.</small>}
          </label>
        </div>
        {dueDate && <button type="button" className="task-due-clear" disabled={isSaving}
          onClick={() => {
            setDueDate('')
            setDueTime('')
            requestAnimationFrame(() => dueDateInput.current?.focus())
          }}>Usuń termin</button>}
      </fieldset>
      <label className="form-field task-description-field">
        <span>Opis / notatki</span>
        <AutoResizeTextarea value={description} disabled={isSaving} onChange={event => setDescription(event.target.value)} />
      </label>
      <div className="task-actions">
        <button type="submit" disabled={isSaving}>{isSaving ? 'Zapisywanie…' : 'Dodaj zadanie'}</button>
        <button type="button" className="secondary-button" disabled={isSaving} onClick={cancel}>Anuluj</button>
      </div>
      {formError && <p className="form-error" role="alert">{formError}</p>}
    </form> : hideTrigger ? null : <button ref={addButton} type="button"
      className={`${isFirstTask ? 'empty-state-primary-button' : 'secondary-button'} add-task-toggle`}
      onClick={(event) => {
        returnFocus.current = event.currentTarget
        setIsExpanded(true)
      }}>
      {isFirstTask ? '+ Dodaj pierwsze zadanie' : '+ Dodaj zadanie'}
    </button>
  )
})

export default CreateTaskForm
