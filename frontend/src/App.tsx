import { useEffect, useState } from 'react'
import { getTasks } from './api/taskApi'
import type { Task } from './types/Task'
import type { Reward } from './types/Reward'
import RewardsPage from './pages/RewardsPage'
import type { TaskSectionData } from './types/TaskSectionData'
import TaskSection from './components/TaskSection'
import Header from './components/Header'
import CreateTaskForm from './components/CreateTaskForm'
import './App.css'

const rewards: Reward[] = [
  { id: 1, title: 'Odcinek ulubionego serialu', cost: 20 },
  { id: 2, title: 'Godzina grania', cost: 40 },
  { id: 3, title: 'Wieczór filmowy', cost: 60 },
]

function App() {
  const [activePage, setActivePage] = useState<'tasks' | 'rewards'>('tasks')
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [purchases, setPurchases] = useState<Reward[]>([])
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadTasks() {
      try {
        const loadedTasks = await getTasks(controller.signal)
        if (!controller.signal.aborted) {
          setTasks(loadedTasks)
        }
      } catch {
        if (!controller.signal.aborted) {
          setLoadError('Nie udało się pobrać zadań. Sprawdź, czy backend działa, i odśwież stronę.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadTasks()
    return () => controller.abort()
  }, [])

  const focusTasks = tasks.filter((task) => task.inFocus)
  const backlogTasks = tasks.filter((task) => !task.inFocus)
  const sections: TaskSectionData[] = [
    {
      id: 'focus',
      title: 'Focus',
      description: 'Zadania, które wybierasz do realizacji.',
      emptyMessage: 'Focus jest pusty. Wybierz zadanie w Backlogu i kliknij „Przenieś do Focus”.',
      tasks: focusTasks,
    },
    {
      id: 'backlog',
      title: 'Backlog',
      description: 'Zadania czekające na realizację. Przenieś wybrane do Focus.',
      emptyMessage: 'Backlog jest pusty. Dodaj nowe zadanie lub przenieś tutaj zadanie z Focus.',
      tasks: backlogTasks,
    },
  ]

  const earnedPoints = tasks.reduce(
    (total, task) => total + (task.completed ? task.points : 0),
    0,
  )
  const spentPoints = purchases.reduce((total, reward) => total + reward.cost, 0)
  const points = earnedPoints - spentPoints

  function buyReward(rewardId: number) {
    const reward = rewards.find((reward) => reward.id === rewardId)
    if (!reward) return

    setPurchases((currentPurchases) => {
      const currentSpentPoints = currentPurchases.reduce((total, purchase) => total + purchase.cost, 0)
      if (earnedPoints - currentSpentPoints < reward.cost) return currentPurchases

      return [...currentPurchases, { ...reward }]
    })
  }

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
      <nav className="page-navigation" aria-label="Widoki aplikacji">
        <button
          type="button"
          className="secondary-button"
          aria-pressed={activePage === 'tasks'}
          aria-controls="tasks-page"
          onClick={() => setActivePage('tasks')}
        >
          Zadania
        </button>
        <button
          type="button"
          className="secondary-button"
          aria-pressed={activePage === 'rewards'}
          aria-controls="rewards-page"
          onClick={() => setActivePage('rewards')}
        >
          Nagrody
        </button>
      </nav>

      <div id="tasks-page" hidden={activePage !== 'tasks'}>
        {isLoading && <p role="status">Ładowanie zadań…</p>}
        {loadError && <p className="form-error" role="alert">{loadError}</p>}
        {!isLoading && !loadError && sections.map((section) => (
          <TaskSection
            key={section.id}
            section={section}
            editingTaskId={editingTaskId}
            onToggleTask={toggleTask}
            onToggleFocus={toggleFocus}
            onStartEditing={startEditing}
            onSave={saveTask}
            onCancel={cancelEditing}
          >
            {section.id === 'backlog' && (
              <CreateTaskForm onAddTask={addTask} />
            )}
          </TaskSection>
        ))}
      </div>
      <div id="rewards-page" hidden={activePage !== 'rewards'}>
        <RewardsPage
          rewards={rewards}
          purchases={purchases}
          points={points}
          onBuyReward={buyReward}
        />
      </div>
    </main>
  )
}

export default App
