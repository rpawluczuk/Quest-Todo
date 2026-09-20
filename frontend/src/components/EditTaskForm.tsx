import { useState } from 'react'
import type { SubmitEvent } from 'react'
import type { Task } from '../types/Task'

type EditTaskFormProps = {
  readonly task: Task
  readonly onSave: (title: string, points: number) => void
  readonly onCancel: () => void
}

function EditTaskForm({ task, onSave, onCancel }: EditTaskFormProps) {
  const [editTitle, setEditTitle] = useState(task.title)
  const [editPoints, setEditPoints] = useState(String(task.points))
  const [editError, setEditError] = useState('')

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

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

    onSave(updatedTitle, taskPoints)
  }

  return (
    <form className="task-form edit-form" onSubmit={handleSubmit}>
      <label className="form-field">
        <span>Nazwa zadania</span>
        <input
          type="text"
          value={editTitle}
          onChange={(event) => setEditTitle(event.target.value)}
          required
        />
      </label>
      <label className="form-field">
        <span>Punkty</span>
        <input
          type="number"
          value={editPoints}
          onChange={(event) => setEditPoints(event.target.value)}
          min="1"
          max={Number.MAX_SAFE_INTEGER}
          step="1"
          required
        />
      </label>
      <div className="task-actions">
        <button type="submit">Zapisz</button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Anuluj
        </button>
      </div>
      {editError && <p className="form-error" role="alert">{editError}</p>}
    </form>
  )
}

export default EditTaskForm
