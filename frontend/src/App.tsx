import { getUser, getPurchases, purchaseReward, consumePurchase, type Purchase, type User } from './api/userApi'
import { useEffect, useRef, useState } from 'react'
import { createReward, deleteReward, getRewards, updateReward } from './api/rewardApi'
import { createTask, deleteTask, getTask, getTaskOverview, updateTask, updateTaskCompletion, updateTaskFocus } from './api/taskApi'
import type { Task } from './types/Task'
import type { Reward, RewardPurchaseType } from './types/Reward'
import RewardsPage from './pages/RewardsPage'
import HabitsPage from './pages/HabitsPage'
import GoalsPage from './pages/GoalsPage'
import type { TaskSectionData } from './types/TaskSectionData'
import TaskSection from './components/TaskSection'
import Header from './components/Header'
import CreateTaskForm from './components/CreateTaskForm'
import CompletionNotice from './components/CompletionNotice'
import { getTaskEmptyStates } from './taskEmptyState'
import { sortActiveTasks } from './taskSorting'
import './App.css'
import type { Theme } from './theme'
import type { CategoryMutation } from './categoryEvents'

type AppProps = {
  onThemeChange: (theme: Theme) => Promise<void>
  user: User
  onLogout: () => Promise<void>
  loggingOut: boolean
  logoutError: string
  onChangePassword: () => void
  onEmail: () => void
  onDeleteAccount: () => void
}

function App({ user, onLogout, loggingOut, logoutError, onChangePassword, onEmail, onDeleteAccount, onThemeChange }: AppProps) {
  const [activePage, setActivePage] = useState<'tasks' | 'habits' | 'goals' | 'rewards'>('tasks')
  const [tasks, setTasks] = useState<Task[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  const [taskRevision, setTaskRevision] = useState(0)
  const [habitGoalRevision, setHabitGoalRevision] = useState(0)
  const [categoryRevision, setCategoryRevision] = useState(0)
  const [lastCompletedTask, setLastCompletedTask] = useState<Task | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [rewardsLoading, setRewardsLoading] = useState(true)
  const [accountLoading, setAccountLoading] = useState(true)
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
  const completionRequests = useRef(new Set<number>())
  function refreshTaskGoalLinks() {
    void getTaskOverview().then(overview => {
      setTasks(overview.tasks)
      setCompletedCount(overview.completedCount)
      setTaskRevision(value => value + 1)
    }).catch(() => {
      // The next navigation or goal mutation retries the task overview.
    })
  }

  function categoriesChanged(change: CategoryMutation) {
    setTasks(current => current.map(task => {
      if (change.type === 'upsert' && task.category?.id === change.category.id) {
        return { ...task, category: change.category }
      }
      if (change.type === 'delete' && task.category?.id === change.id) {
        return { ...task, category: null }
      }
      return task
    }))
    setTaskRevision(value => value + 1)
    setCategoryRevision(value => value + 1)
  }

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
    void refreshAccount(controller.signal).finally(() => {
      if (!controller.signal.aborted) setAccountLoading(false)
    })
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
        const loadedTasks = await getTaskOverview(controller.signal)
        if (!controller.signal.aborted) {
          setTasks(loadedTasks.tasks)
          setCompletedCount(loadedTasks.completedCount)
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

  useEffect(() => {
    const controller = new AbortController()
    const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date())
    let lastDay = day()
    let refreshing = false
    async function refreshPriorities() {
      const today = day()
      if (today === lastDay || refreshing || document.visibilityState === 'hidden') return
      refreshing = true
      try {
        const overview = await getTaskOverview(controller.signal)
        if (controller.signal.aborted) return
        const promoted = new Map(overview.tasks.filter(task => task.inFocus).map(task => [task.id, task]))
        // Preserve local edits and loaded history while applying automatic promotions.
        setTasks(current => current.map(task => {
          const remote = promoted.get(task.id)
          return remote && !task.completed && !task.inFocus && task.dueDate === remote.dueDate
            ? { ...task, inFocus: true } : task
        }))
        setTaskRevision(value => value + 1)
        lastDay = today
      } catch {
        // Retry on the next tick or when the app becomes visible again.
      } finally { refreshing = false }
    }
    const timer = window.setInterval(() => void refreshPriorities(), 60_000)
    document.addEventListener('visibilitychange', refreshPriorities)
    window.addEventListener('focus', refreshPriorities)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshPriorities)
      window.removeEventListener('focus', refreshPriorities)
    }
  }, [])

  const focusTasks = sortActiveTasks(tasks.filter((task) => !task.completed && task.inFocus))
  const backlogTasks = sortActiveTasks(tasks.filter((task) => !task.completed && !task.inFocus))
  const completedTasks = tasks.filter((task) => task.completed).sort((a, b) =>
    (b.completedAt ? Date.parse(b.completedAt) : 0) - (a.completedAt ? Date.parse(a.completedAt) : 0)
    || b.id - a.id,
  )
  const taskEmptyStates = getTaskEmptyStates(focusTasks.length, backlogTasks.length, tasks.length + completedCount)
  const sections: TaskSectionData[] = [
    {
      id: 'focus',
      title: 'Moje priorytety',
      description: 'Zadania, na których chcesz się teraz skupić.',
      emptyState: taskEmptyStates.focus,
      tasks: focusTasks,
    },
    {
      id: 'backlog',
      title: 'Pozostałe zadania',
      description: 'Zadania, które czekają na swoją kolej.',
      emptyState: taskEmptyStates.backlog,
      tasks: backlogTasks,
    },
    {
      id: 'completed',
      title: 'Ukończone',
      description: 'Ostatnio ukończone zadania.',
      emptyState: { message: 'Nie masz jeszcze ukończonych zadań.' },
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
      setRewards(current => current.filter(reward => reward.id !== rewardId || reward.purchaseType !== 'ONE_TIME'))
    } catch (error) {
      purchaseError = error instanceof Error ? error.message : 'Nie udało się kupić nagrody.'
    } finally {
      await refreshAccount()
      if (purchaseError) setAccountError(purchaseError)
      buyingRef.current = false
      setBuying(false)
    }
  }

  async function addTask(title: string, taskPoints: number, description: string, dueDate: string, dueTime: string,
    categoryId: number | null, goalIds: number[]) {
    const task = await createTask(title, taskPoints, description, dueDate, dueTime, categoryId, goalIds)
    setTasks((currentTasks) => [...currentTasks, task])
  }

  async function redeemPurchase(id: number) {
    try {
      const updated = await consumePurchase(id)
      accountRequest.current++
      setPurchases((current) => current.map((purchase) => purchase.id === id ? updated : purchase))
    } finally {
      await refreshAccount()
    }
  }

  async function addReward(title: string, cost: number, purchaseType: RewardPurchaseType) {
    const reward = await createReward(title, cost, purchaseType)
    setRewards((currentRewards) => [...currentRewards, reward])
  }

  async function removeReward(id: number) {
    await deleteReward(id)
    setRewards((current) => current.filter((reward) => reward.id !== id))
  }

  async function saveReward(id: number, title: string, cost: number, purchaseType: RewardPurchaseType) {
    const updatedReward = await updateReward(id, title, cost, purchaseType)
    setRewards((currentRewards) =>
      currentRewards.map((reward) => reward.id === id ? updatedReward : reward),
    )
  }

  function startEditing(taskId: number) {
    const task = tasks.find((task) => task.id === taskId)
    if (!task || task.completed) return

    setEditingTaskId(task.id)
  }

  function cancelEditing() {
    setEditingTaskId(null)
  }

  async function saveTask(title: string, taskPoints: number, description: string, dueDate: string, dueTime: string,
    categoryId: number | null, goalIds: number[]) {
    if (editingTaskId === null) return
    const updatedTask = await updateTask(editingTaskId, title, taskPoints, description, dueDate, dueTime,
      categoryId, goalIds)
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === editingTaskId && !task.completed
          ? updatedTask
          : task,
      ),
    )
    cancelEditing()
    setTaskRevision(value => value + 1)
  }

  async function removeTask(taskId: number) {
    const task = tasks.find(item => item.id === taskId) ?? await getTask(taskId)
    await deleteTask(taskId)
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId))
    if (task.completed) setCompletedCount(count => Math.max(0, count - 1))
    setLastCompletedTask(current => current?.id === taskId ? null : current)
    setTaskRevision(value => value + 1)
  }

  async function toggleFocus(taskId: number) {
    const task = tasks.find((task) => task.id === taskId)
    if (!task) return
    const updatedTask = await updateTaskFocus(taskId, !task.inFocus)
    setTasks((currentTasks) => currentTasks.map((item) => item.id === taskId ? updatedTask : item))
  }

  async function toggleTask(taskId: number) {
    if (completionRequests.current.has(taskId)) return
    completionRequests.current.add(taskId)
    try {
      const task = await getTask(taskId)
      const updatedTask = await updateTaskCompletion(taskId, !task.completed)
      setTasks(current => [...current.filter(item => item.id !== taskId), ...(!updatedTask.completed ? [updatedTask] : [])].sort((a, b) => a.id - b.id))
      setCompletedCount(count => Math.max(0, count + (updatedTask.completed ? 1 : -1)))
      if (updatedTask.completed) setLastCompletedTask(updatedTask)
      else setLastCompletedTask(current => current?.id === taskId ? null : current)
      setTaskRevision(value => value + 1)
    } finally {
      completionRequests.current.delete(taskId)
      await refreshAccount()
    }
  }
  return (
    <main className="quest-app">
      <Header points={points} username={user.login ?? ''} onLogout={onLogout} loggingOut={loggingOut} onChangePassword={onChangePassword} onEmail={onEmail} onDeleteAccount={onDeleteAccount}
        onCategoriesChanged={categoriesChanged} theme={user.theme === 'PINK' ? 'pink' : 'purple'} onThemeChange={onThemeChange} />
      {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
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
          aria-pressed={activePage === 'habits'}
          aria-controls="habits-page"
          onClick={() => setActivePage('habits')}
        >
          Nawyki
        </button>
        <button
          type="button"
          className="secondary-button"
          aria-pressed={activePage === 'goals'}
          aria-controls="goals-page"
          onClick={() => setActivePage('goals')}
        >
          Cele
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
            history={section.id === 'completed' ? { count: completedCount, revision: taskRevision, onCount: setCompletedCount } : undefined}
            editingTaskId={editingTaskId}
            onToggleTask={toggleTask}
            onDelete={removeTask}
            onToggleFocus={toggleFocus}
            onStartEditing={startEditing}
            onSave={saveTask}
            onCancel={cancelEditing}
          >
            {section.id === 'backlog' && (
              <CreateTaskForm onAddTask={addTask} isFirstTask={Boolean(section.emptyState.prominent)} />
            )}
          </TaskSection>
        ))}
        {lastCompletedTask && (
          <CompletionNotice
            key={lastCompletedTask.id}
            task={lastCompletedTask}
            onUndo={toggleTask}
            onDismiss={() => setLastCompletedTask(null)}
          />
        )}
      </div>
      <div id="habits-page" hidden={activePage !== 'habits'}>
        <HabitsPage goalLinksRevision={habitGoalRevision} categoryRevision={categoryRevision} onPointsChanged={balance => {
          accountRequest.current++
          setPoints(balance)
        }} />
      </div>
      <div id="goals-page" hidden={activePage !== 'goals'}>
        <GoalsPage taskRevision={taskRevision} tasksDisabled={editingTaskId !== null} onToggleTask={toggleTask}
          onGoalLinksChanged={refreshTaskGoalLinks}
          onHabitGoalLinksChanged={() => setHabitGoalRevision(value => value + 1)} />
      </div>
      <div id="rewards-page" hidden={activePage !== 'rewards'}>
        {(rewardsLoading || accountLoading) && <p role="status">Ładowanie nagród…</p>}
        {rewardsError && <p className="form-error" role="alert">{rewardsError}</p>}
        {!rewardsLoading && !accountLoading && !rewardsError && (
        <RewardsPage
          rewards={rewards}
          purchases={purchases}
          points={points}
          buying={buying}
          onBuyReward={buyReward}
          onAddReward={addReward}
          onSaveReward={saveReward}
          onDeleteReward={removeReward}
          onUsePurchase={redeemPurchase}
        />
        )}
      </div>
    </main>
  )
}

export default App
