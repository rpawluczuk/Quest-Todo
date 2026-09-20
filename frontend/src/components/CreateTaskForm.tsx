import { useState } from 'react'
import type { SubmitEvent } from 'react'

type CreateTaskFormProps = {
  readonly onAddTask: (title: string, points: number) => void
}

function CreateTaskForm({ onAddTask }: CreateTaskFormProps) {
  const [newTitle, setNewTitle] = useState('')
  const [newPoints, setNewPoints] = useState('10')
  const [formError, setFormError] = useState('')

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

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

    onAddTask(title, taskPoints)
    setNewTitle('')
    setNewPoints('10')
    setFormError('')
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <label className="form-field">
        <span>Nazwa zadania</span>
        <input
          type="text"
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
          value={newPoints}
          onChange={(event) => setNewPoints(event.target.value)}
          min="1"
          max={Number.MAX_SAFE_INTEGER}
          step="1"
          required
        />
      </label>
      <button type="submit">Dodaj zadanie</button>
      {formError && <p className="form-error" role="alert">{formError}</p>}
    </form>
  )
}

export default CreateTaskForm
