import { useState } from 'react'
import type { Task } from './types/Task'
import TaskItem from './components/TaskItem'
import Header from './components/Header'
import CreateTaskForm from './components/CreateTaskForm'
import './App.css'

const initialTasks: Task[] = [
  { id: 1, title: 'Poświęcić 20 minut na naukę Reacta', points: 20, completed: false, inFocus: false },
  { id: 2, title: 'Wybrać się na spacer', points: 15, completed: false, inFocus: false },
  { id: 3, title: 'Przeczytać rozdział książki', points: 10, completed: false, inFocus: false },
]

function App() {
  const [tasks, setTasks] = useState(initialTasks)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)

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

  function addTask(title: string, taskPoints: number) {
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
  }

  function startEditing(taskId: number) {
    const task = tasks.find((task) => task.id === taskId)
    if (!task || task.completed) return

    setEditingTaskId(task.id)
  }

  function cancelEditing() {
    setEditingTaskId(null)
  }

  function saveTask(title: string, taskPoints: number) {
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
            <CreateTaskForm onAddTask={addTask} />
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
              <TaskItem
                key={task.id}
                task={task}
                isEditing={editingTaskId === task.id}
                isAnyTaskEditing={editingTaskId !== null}
                onToggleTask={toggleTask}
                onToggleFocus={toggleFocus}
                onStartEditing={startEditing}
                onSave={saveTask}
                onCancel={cancelEditing}
              />
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}

export default App
