import { useState } from 'react'
import type { SubmitEvent } from 'react'
import type { Task } from '../types/Task'

type EditTaskFormProps = {
  readonly task: Task
  readonly onSave: (title: string, points: number) => Promise<void>
  readonly onCancel: () => void
}

function EditTaskForm({ task, onSave, onCancel }: EditTaskFormProps) {
  const [editTitle, setEditTitle] = useState(task.title)
  const [editPoints, setEditPoints] = useState(String(task.points))
  const [editError, setEditError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return

    const updatedTitle = editTitle.trim()
    const taskPoints = Number(editPoints)

    if (!updatedTitle) {
      setEditError('Wpisz nazwę zadania — same spacje nie wystarczą.')
      return
    }

    if (!Number.isSafeInteger(taskPoints) || taskPoints <= 0) {
      setEditError('Punkty muszą być dodatnią liczbą całkowitą.')
      return
    }

    if (taskPoints > 2147483647) {
      setEditError('Maksymalna liczba punktów to 2147483647.')
      return
    }
    setIsSaving(true)
    setEditError('')
    try {
      await onSave(updatedTitle, taskPoints)
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Nie udało się zapisać zmian. Spróbuj ponownie.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="task-form edit-form" onSubmit={handleSubmit}>
      <label className="form-field">
        <span>Nazwa zadania</span>
        <input
          type="text"
          disabled={isSaving}
          value={editTitle}
          onChange={(event) => setEditTitle(event.target.value)}
          required
        />
      </label>
      <label className="form-field">
        <span>Punkty</span>
        <input
          type="number"
          disabled={isSaving}
          value={editPoints}
          onChange={(event) => setEditPoints(event.target.value)}
          min="1"
          max={2147483647}
          step="1"
          required
        />
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
