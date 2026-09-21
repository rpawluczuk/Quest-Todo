import { useEffect, useState } from 'react'
import { getRewards } from './api/rewardApi'
import { createTask, getTasks, updateTask, updateTaskCompletion, updateTaskFocus } from './api/taskApi'
import type { Task } from './types/Task'
import type { Reward } from './types/Reward'
import RewardsPage from './pages/RewardsPage'
import type { TaskSectionData } from './types/TaskSectionData'
import TaskSection from './components/TaskSection'
import Header from './components/Header'
import CreateTaskForm from './components/CreateTaskForm'
import './App.css'

function App() {
  const [activePage, setActivePage] = useState<'tasks' | 'rewards'>('tasks')
  const [tasks, setTasks] = useState<Task[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [rewardsLoading, setRewardsLoading] = useState(true)
  const [rewardsError, setRewardsError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [purchases, setPurchases] = useState<Reward[]>([])
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    async function loadRewards() {
      try {
        const loadedRewards = await getRewards(controller.signal)
        if (!controller.signal.aborted) setRewards(loadedRewards)
      } catch {
        if (!controller.signal.aborted) {
          setRewardsError('Nie udało się pobrać nagród. Sprawdź backend i odśwież stronę.')
        }
      } finally {
        if (!controller.signal.aborted) setRewardsLoading(false)
      }
    }
    void loadRewards()
    return () => controller.abort()
  }, [])

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

  async function addTask(title: string, taskPoints: number) {
    const task = await createTask(title, taskPoints)
    setTasks((currentTasks) => [...currentTasks, task])
  }

  function startEditing(taskId: number) {
    const task = tasks.find((task) => task.id === taskId)
    if (!task || task.completed) return

    setEditingTaskId(task.id)
  }

  function cancelEditing() {
    setEditingTaskId(null)
  }

  async function saveTask(title: string, taskPoints: number) {
    if (editingTaskId === null) return
    const updatedTask = await updateTask(editingTaskId, title, taskPoints)
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === editingTaskId && !task.completed
          ? { ...task, title: updatedTask.title, points: updatedTask.points }
          : task,
      ),
    )
    cancelEditing()
  }

  async function toggleFocus(taskId: number) {
    const task = tasks.find((task) => task.id === taskId)
    if (!task) return
    const updatedTask = await updateTaskFocus(taskId, !task.inFocus)
    setTasks((currentTasks) => currentTasks.map((item) => item.id === taskId ? updatedTask : item))
  }

  async function toggleTask(taskId: number) {
    const task = tasks.find((task) => task.id === taskId)
    if (!task) return
    const updatedTask = await updateTaskCompletion(taskId, !task.completed)
    setTasks((currentTasks) => currentTasks.map((item) => item.id === taskId ? updatedTask : item))
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
        {rewardsLoading && <p role="status">Ładowanie nagród…</p>}
        {rewardsError && <p className="form-error" role="alert">{rewardsError}</p>}
        {!rewardsLoading && !rewardsError && (
        <RewardsPage
          rewards={rewards}
          purchases={purchases}
          points={points}
          onBuyReward={buyReward}
        />
        )}
      </div>
    </main>
  )
}

export default App
