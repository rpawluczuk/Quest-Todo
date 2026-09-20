import { useState } from 'react'
import type { SubmitEvent } from 'react'
import Header from './components/Header'
import './App.css'

const initialTasks = [
  { id: 1, title: 'Poświęcić 20 minut na naukę Reacta', points: 20, completed: false, inFocus: false },
  { id: 2, title: 'Wybrać się na spacer', points: 15, completed: false, inFocus: false },
  { id: 3, title: 'Przeczytać rozdział książki', points: 10, completed: false, inFocus: false },
]

function App() {
  const [tasks, setTasks] = useState(initialTasks)
  const [editingSection, setEditingSection] = useState<'backlog' | 'focus' | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newPoints, setNewPoints] = useState('10')
  const [formError, setFormError] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPoints, setEditPoints] = useState('')
  const [editError, setEditError] = useState('')

  const focusTasks = tasks.filter((task) => task.inFocus)
  const backlogTasks = tasks.filter((task) => !task.inFocus)
  const sections = [
    { id: 'focus' as const, title: 'Focus', description: 'Zadania, które wybierasz do realizacji.', tasks: focusTasks },
    { id: 'backlog' as const, title: 'Backlog', description: 'Zadania czekające na realizację. Przenieś wybrane do Focus.', tasks: backlogTasks },
  ]

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
        inFocus: false,
      },
    ])
    setNewTitle('')
    setNewPoints('10')
    setFormError('')
  }

  function startEditing(taskId: number, sectionId: 'backlog' | 'focus') {
    const task = tasks.find((task) => task.id === taskId)
    if (!task || task.completed) return

    setEditingTaskId(task.id)
    setEditingSection(sectionId)
    setEditTitle(task.title)
    setEditPoints(String(task.points))
    setEditError('')
  }

  function cancelEditing() {
    setEditingTaskId(null)
    setEditingSection(null)
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

  function toggleFocus(taskId: number) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, inFocus: !task.inFocus } : task,
      ),
    )
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
      <Header points={points} />

      {sections.map((section) => (
        <section className="tasks-section" aria-labelledby={`${section.id}-heading`} key={section.id}>
          <div className="section-header">
            <h2 id={`${section.id}-heading`} lang="en">{section.title} ({section.tasks.length})</h2>
            <p>{section.description}</p>
          </div>
          {section.id === 'backlog' && (
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
          )}
          {section.tasks.length === 0 && (
            <p className="empty-state">
              {section.id === 'focus'
                ? 'Focus jest pusty. Wybierz zadanie w Backlogu i kliknij „Przenieś do Focus”.'
                : 'Backlog jest pusty. Dodaj nowe zadanie lub przenieś tutaj zadanie z Focus.'}
            </p>
          )}
          <ul className="task-list">
            {section.tasks.map((task) => (
              <li className={task.completed ? 'task task-completed' : 'task'} key={task.id}>
                {editingTaskId === task.id && editingSection === section.id ? (
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
                        disabled={editingTaskId === task.id}
                        onChange={() => toggleTask(task.id)}
                      />
                      <span className="task-title">{task.title}</span>
                    </label>
                    <div className="task-actions">
                      <span className="task-points">{task.points} pkt</span>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => toggleFocus(task.id)}
                        disabled={editingTaskId !== null}
                        aria-label={`${task.inFocus ? 'Przenieś do Backlogu' : 'Przenieś do Focus'}: ${task.title}`}
                      >
                        {task.inFocus ? 'Przenieś do Backlogu' : 'Przenieś do Focus'}
                      </button>
                      {!task.completed && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => startEditing(task.id, section.id)}
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
      ))}
    </main>
  )
}

export default App
