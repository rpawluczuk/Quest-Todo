import { useState } from 'react'
import type { SubmitEvent } from 'react'
import './App.css'

const initialTasks = [
  { id: 1, title: 'Poświęcić 20 minut na naukę Reacta', points: 20, completed: false },
  { id: 2, title: 'Wybrać się na spacer', points: 15, completed: false },
  { id: 3, title: 'Przeczytać rozdział książki', points: 10, completed: false },
]

function App() {
  const [tasks, setTasks] = useState(initialTasks)
  const [newTitle, setNewTitle] = useState('')
  const [newPoints, setNewPoints] = useState('10')
  const [formError, setFormError] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPoints, setEditPoints] = useState('')
  const [editError, setEditError] = useState('')

  const points = tasks.reduce(
    (total, task) => total + (task.completed ? task.points : 0),
    0,
  )

  function addTask(event: SubmitEvent<HTMLFormElement>) {
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

    setTasks((currentTasks) => [
      ...currentTasks,
      {
        id: currentTasks.reduce((maxId, task) => Math.max(maxId, task.id), 0) + 1,
        title,
        points: taskPoints,
        completed: false,
      },
    ])
    setNewTitle('')
    setNewPoints('10')
    setFormError('')
  }

  function startEditing(taskId: number) {
    const task = tasks.find((task) => task.id === taskId)
    if (!task || task.completed) return

    setEditingTaskId(task.id)
    setEditTitle(task.title)
    setEditPoints(String(task.points))
    setEditError('')
  }

  function cancelEditing() {
    setEditingTaskId(null)
    setEditTitle('')
    setEditPoints('')
    setEditError('')
  }

  function saveTask(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

    const title = editTitle.trim()
    const taskPoints = Number(editPoints)

    if (!title) {
      setEditError('Wpisz nazwę zadania — same spacje nie wystarczą.')
      return
    }

    if (!Number.isSafeInteger(taskPoints) || taskPoints <= 0) {
      setEditError('Punkty muszą być dodatnią liczbą całkowitą.')
      return
    }

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === editingTaskId && !task.completed
          ? { ...task, title, points: taskPoints }
          : task,
      ),
    )
    cancelEditing()
  }

  function toggleTask(taskId: number) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task,
      ),
    )
  }

  return (
    <main className="quest-app">
      <header className="app-header">
        <div>
          <p className="eyebrow">Małe kroki, codzienne zwycięstwa</p>
          <h1>Quest Todo</h1>
          <p className="subtitle">Zrób miejsce na to, co ważne.</p>
        </div>
        <div className="points-balance">
          <span>Twoje saldo</span>
          <strong aria-live="polite">{points} punktów</strong>
        </div>
      </header>

      <section className="today-section" aria-labelledby="today-heading">
        <div className="section-header">
          <h2 id="today-heading" lang="en">Today</h2>
          <p>Twoje zadania na dziś</p>
        </div>
        <form className="task-form" onSubmit={addTask}>
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
        <ul className="task-list">
          {tasks.map((task) => (
            <li className={task.completed ? 'task task-completed' : 'task'} key={task.id}>
              {editingTaskId === task.id ? (
                <form className="task-form edit-form" onSubmit={saveTask}>
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
                    <button type="button" className="secondary-button" onClick={cancelEditing}>
                      Anuluj
                    </button>
                  </div>
                  {editError && <p className="form-error" role="alert">{editError}</p>}
                </form>
              ) : (
                <>
                  <label className="task-label">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(task.id)}
                    />
                    <span className="task-title">{task.title}</span>
                  </label>
                  <div className="task-actions">
                    <span className="task-points">{task.points} pkt</span>
                    {!task.completed && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => startEditing(task.id)}
                        disabled={editingTaskId !== null}
                        aria-label={`Edytuj zadanie: ${task.title}`}
                      >
                        Edytuj
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
