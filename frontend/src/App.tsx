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
            Nazwa zadania
            <input
              type="text"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Co chcesz zrobić?"
              required
            />
          </label>
          <label className="form-field">
            Punkty
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
              <label className="task-label">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task.id)}
                />
                <span className="task-title">{task.title}</span>
              </label>
              <span className="task-points">{task.points} pkt</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
