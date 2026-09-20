import { useState } from 'react'
import type { SubmitEvent } from 'react'

type CreateTaskFormProps = {
  readonly onAddTask: (title: string, points: number) => Promise<void>
}

function CreateTaskForm({ onAddTask }: CreateTaskFormProps) {
  const [newTitle, setNewTitle] = useState('')
  const [newPoints, setNewPoints] = useState('10')
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

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

    if (taskPoints > 2147483647) {
      setFormError('Maksymalna liczba punktów to 2147483647.')
      return
    }

    setIsSaving(true)
    setFormError('')
    try {
      await onAddTask(title, taskPoints)
      setNewTitle('')
      setNewPoints('10')
    } catch {
      setFormError('Nie udało się zapisać zadania. Sprawdź połączenie z backendem i spróbuj ponownie.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <label className="form-field">
        <span>Nazwa zadania</span>
        <input
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
      <button type="submit" disabled={isSaving}>{isSaving ? 'Zapisywanie…' : 'Dodaj zadanie'}</button>
      {formError && <p className="form-error" role="alert">{formError}</p>}
    </form>
  )
}

export default CreateTaskForm
