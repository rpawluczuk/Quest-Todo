import { useEffect, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'

type CreateTaskFormProps = {
  readonly onAddTask: (title: string, points: number) => Promise<void>
}

function CreateTaskForm({ onAddTask }: CreateTaskFormProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPoints, setNewPoints] = useState('10')
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const addButton = useRef<HTMLButtonElement>(null)
  const titleInput = useRef<HTMLInputElement>(null)
  const wasExpanded = useRef(false)

  useEffect(() => {
    if (isExpanded) titleInput.current?.focus()
    else if (wasExpanded.current) addButton.current?.focus()
    wasExpanded.current = isExpanded
  }, [isExpanded])

  function cancel() {
    setNewTitle('')
    setNewPoints('10')
    setFormError('')
    setIsExpanded(false)
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return

    const title = newTitle.trim()
    const taskPoints = Number(newPoints)

    if (!title) {
      setFormError('Wpisz nazwę zadania — same spacje nie wystarczą.')
      return
    }

    if (!Number.isSafeInteger(taskPoints) || taskPoints <= 0) {
      setFormError('Punkty muszą być dodatnią liczbą całkowitą.')
      return
    }

    if (taskPoints > 1000) {
      setFormError('Maksymalna liczba punktów to 1000.')
      return
    }

    setIsSaving(true)
    setFormError('')
    try {
      await onAddTask(title, taskPoints)
      setNewTitle('')
      setNewPoints('10')
      setIsExpanded(false)
    } catch {
      setFormError('Nie udało się zapisać zadania. Sprawdź połączenie z backendem i spróbuj ponownie.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    isExpanded ? <form className="task-form" onSubmit={handleSubmit}>
      <label className="form-field">
        <span>Nazwa zadania</span>
        <input
          ref={titleInput}
          type="text"
          disabled={isSaving}
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="Co chcesz zrobić?"
          required
        />
      </label>
      <label className="form-field">
        <span>Punkty</span>
        <input
          type="number"
          disabled={isSaving}
          value={newPoints}
          onChange={(event) => setNewPoints(event.target.value)}
          min="1"
          max={2147483647}
          step="1"
          required
        />
      </label>
      <div className="task-actions">
        <button type="submit" disabled={isSaving}>{isSaving ? 'Zapisywanie…' : 'Dodaj zadanie'}</button>
        <button type="button" className="secondary-button" disabled={isSaving} onClick={cancel}>Anuluj</button>
      </div>
      {formError && <p className="form-error" role="alert">{formError}</p>}
    </form> : <button ref={addButton} type="button" className="secondary-button add-task-toggle" onClick={() => setIsExpanded(true)}>+ Dodaj zadanie</button>
  )
}

export default CreateTaskForm
