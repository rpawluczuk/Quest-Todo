import { getUser, getPurchases, purchaseReward, type Purchase } from './api/userApi'
import { useEffect, useRef, useState } from 'react'
import { createReward, getRewards } from './api/rewardApi'
import { createTask, deleteTask, getTasks, updateTask, updateTaskCompletion, updateTaskFocus } from './api/taskApi'
import type { Task } from './types/Task'
import type { Reward } from './types/Reward'
import RewardsPage from './pages/RewardsPage'
import type { TaskSectionData } from './types/TaskSectionData'
import TaskSection from './components/TaskSection'
import Header from './components/Header'
import CreateTaskForm from './components/CreateTaskForm'
import CompletionNotice from './components/CompletionNotice'
import './App.css'

function App() {
  const [activePage, setActivePage] = useState<'tasks' | 'rewards'>('tasks')
  const [tasks, setTasks] = useState<Task[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [rewardsLoading, setRewardsLoading] = useState(true)
  const [rewardsError, setRewardsError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [points, setPoints] = useState<number | null>(null)
  const [accountError, setAccountError] = useState('')
  const [buying, setBuying] = useState(false)
  const buyingRef = useRef(false)
  const accountRequest = useRef(0)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [lastCompletedId, setLastCompletedId] = useState<number | null>(null)
  const completionRequests = useRef(new Set<number>())

  async function refreshAccount(signal?: AbortSignal) {
    const request = ++accountRequest.current
    try {
      const [user, history] = await Promise.all([getUser(signal), getPurchases(signal)])
      if (!signal?.aborted && request === accountRequest.current) {
        setPoints(user.points)
        setPurchases(history)
        setAccountError('')
      }
    } catch {
      if (!signal?.aborted && request === accountRequest.current) {
        setPoints(null)
        setAccountError('Nie udało się odświeżyć salda i zakupów. Odśwież stronę.')
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    // State updates in refreshAccount run only after the API requests settle.
    // oxlint-disable-next-line react/set-state-in-effect
    void refreshAccount(controller.signal)
    return () => controller.abort()
  }, [])

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

  const focusTasks = tasks.filter((task) => !task.completed && task.inFocus)
  const backlogTasks = tasks.filter((task) => !task.completed && !task.inFocus)
  const completedTasks = tasks.filter((task) => task.completed).sort((a, b) =>
    (b.completedAt ? Date.parse(b.completedAt) : 0) - (a.completedAt ? Date.parse(a.completedAt) : 0)
    || b.id - a.id,
  )
  const lastCompletedTask = tasks.find((task) => task.id === lastCompletedId && task.completed)
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
    {
      id: 'completed',
      title: 'Ukończone',
      description: 'Najnowsze ukończenia są na górze. Cofnij ukończenie, aby przywrócić zadanie do poprzedniej listy.',
      emptyMessage: 'Nie masz jeszcze ukończonych zadań.',
      tasks: completedTasks,
    },
  ]

  async function buyReward(rewardId: number) {
    if (buyingRef.current || points === null) return
    buyingRef.current = true
    setBuying(true)
    let purchaseError = ''
    try {
      await purchaseReward(rewardId)
    } catch (error) {
      purchaseError = error instanceof Error ? error.message : 'Nie udało się kupić nagrody.'
    } finally {
      await refreshAccount()
      if (purchaseError) setAccountError(purchaseError)
      buyingRef.current = false
      setBuying(false)
    }
  }

  async function addTask(title: string, taskPoints: number) {
    const task = await createTask(title, taskPoints)
    setTasks((currentTasks) => [...currentTasks, task])
  }

  async function addReward(title: string, cost: number) {
    const reward = await createReward(title, cost)
    setRewards((currentRewards) => [...currentRewards, reward])
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

  async function removeTask(taskId: number) {
    await deleteTask(taskId)
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId))
  }

  async function toggleFocus(taskId: number) {
    const task = tasks.find((task) => task.id === taskId)
    if (!task) return
    const updatedTask = await updateTaskFocus(taskId, !task.inFocus)
    setTasks((currentTasks) => currentTasks.map((item) => item.id === taskId ? updatedTask : item))
  }

  async function toggleTask(taskId: number) {
    const task = tasks.find((task) => task.id === taskId)
    if (!task || completionRequests.current.has(taskId)) return
    completionRequests.current.add(taskId)
    try {
      const updatedTask = await updateTaskCompletion(taskId, !task.completed)
      setTasks((currentTasks) => currentTasks.map((item) => item.id === taskId ? updatedTask : item))
      if (updatedTask.completed) setLastCompletedId(taskId)
      else setLastCompletedId((currentId) => currentId === taskId ? null : currentId)
    } finally {
      completionRequests.current.delete(taskId)
      await refreshAccount()
    }
  }
  return (
    <main className="quest-app">
      <Header points={points} />
      {accountError && <p className="form-error" role="alert">{accountError}</p>}
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
            onDelete={removeTask}
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
        {lastCompletedTask && (
          <CompletionNotice
            key={lastCompletedTask.id}
            task={lastCompletedTask}
            onUndo={toggleTask}
            onDismiss={() => setLastCompletedId(null)}
          />
        )}
      </div>
      <div id="rewards-page" hidden={activePage !== 'rewards'}>
        {rewardsLoading && <p role="status">Ładowanie nagród…</p>}
        {rewardsError && <p className="form-error" role="alert">{rewardsError}</p>}
        {!rewardsLoading && !rewardsError && (
        <RewardsPage
          rewards={rewards}
          purchases={purchases}
          points={points}
          buying={buying}
          onBuyReward={buyReward}
          onAddReward={addReward}
        />
        )}
      </div>
    </main>
  )
}

export default App
