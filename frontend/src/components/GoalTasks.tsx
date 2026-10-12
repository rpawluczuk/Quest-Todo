import { useEffect, useRef, useState } from 'react'
import { getAvailableGoalTasks, getGoalTasks, setGoalTask } from '../api/goalApi'
import type { Task } from '../types/Task'

export type GoalTasksProps = {
  tasksDisabled: boolean
  onToggleTask: (id: number) => Promise<void>
}

function mergeTasks(current: Task[], next: Task[]): Task[] {
  const known = new Set(current.map(task => task.id))
  return [...current, ...next.filter(task => !known.has(task.id))]
}

export default function GoalTasks({ goalId, tasksDisabled, onToggleTask }: GoalTasksProps & { goalId: number }) {
  const [attached, setAttached] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<Task[]>([])
  const [activePage, setActivePage] = useState(0)
  const [activeHasMore, setActiveHasMore] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [completed, setCompleted] = useState<Task[]>([])
  const [completedPage, setCompletedPage] = useState(0)
  const [completedHasMore, setCompletedHasMore] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const searchInput = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    getGoalTasks(goalId, controller.signal).then(loaded => {
      if (!controller.signal.aborted) setAttached(loaded)
    }).catch(failure => {
      if (!controller.signal.aborted) setLoadError(failure instanceof Error ? failure.message : 'Nie udało się pobrać zadań celu.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [goalId])

  useEffect(() => {
    if (!pickerOpen || queryInput.trim() === query) return
    const timer = window.setTimeout(() => {
      setPickerLoading(true)
      setQuery(queryInput.trim())
    }, 250)
    return () => window.clearTimeout(timer)
  }, [pickerOpen, query, queryInput])

  useEffect(() => {
    if (!pickerOpen) return
    const controller = new AbortController()
    const requests: Promise<void>[] = [getAvailableGoalTasks(goalId, false, query, 0, controller.signal).then(result => {
      setActive(result.tasks)
      setActivePage(0)
      setActiveHasMore(result.hasMore)
    })]
    if (showCompleted) requests.push(getAvailableGoalTasks(goalId, true, query, 0, controller.signal).then(result => {
      setCompleted(result.tasks)
      setCompletedPage(0)
      setCompletedHasMore(result.hasMore)
    }))
    Promise.all(requests).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Nie udało się pobrać zadań do przypięcia.')
    }).finally(() => { if (!controller.signal.aborted) setPickerLoading(false) })
    return () => controller.abort()
  }, [goalId, pickerOpen, query, showCompleted])

  useEffect(() => { if (pickerOpen) searchInput.current?.focus() }, [pickerOpen])

  const disabled = busy || tasksDisabled
  const priorityTasks = active.filter(task => task.inFocus)
  const backlogTasks = active.filter(task => !task.inFocus)

  async function run(action: () => Promise<void>) {
    if (sending.current || tasksDisabled) return
    sending.current = true
    setBusy(true)
    setError('')
    try { await action() }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Nie udało się zapisać zmiany.') }
    finally { sending.current = false; setBusy(false) }
  }

  function closePicker() {
    setPickerOpen(false)
    setQueryInput('')
    setQuery('')
    setShowCompleted(false)
    setActive([])
    setCompleted([])
    setError('')
    trigger.current?.focus()
  }

  function attach(task: Task) {
    void run(async () => {
      await setGoalTask(goalId, task.id, true)
      setAttached(current => mergeTasks(current, [task]))
      closePicker()
    })
  }

  async function loadMore(isCompleted: boolean) {
    if (sending.current) return
    sending.current = true
    setPickerLoading(true)
    setError('')
    const nextPage = (isCompleted ? completedPage : activePage) + 1
    try {
      const result = await getAvailableGoalTasks(goalId, isCompleted, query, nextPage)
      if (isCompleted) {
        setCompleted(current => mergeTasks(current, result.tasks))
        setCompletedPage(nextPage)
        setCompletedHasMore(result.hasMore)
      } else {
        setActive(current => mergeTasks(current, result.tasks))
        setActivePage(nextPage)
        setActiveHasMore(result.hasMore)
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się pobrać kolejnych zadań.')
    } finally { sending.current = false; setPickerLoading(false) }
  }

  function availableList(tasks: Task[]) {
    return <ul className="goal-available-list">{tasks.map(task => <li key={task.id} className="goal-available-task">
      <span className="goal-available-task-title">{task.title}</span>
      <span className="task-points">{task.points} pkt</span>
      <button type="button" className="secondary-button" disabled={disabled}
        aria-label={`Przypnij zadanie: ${task.title}`} onClick={() => attach(task)}>Przypnij</button>
    </li>)}</ul>
  }

  return <div className="goal-tasks" id={`goal-tasks-${goalId}`}>
    <h3>Zadania</h3>
    {loading ? <p role="status">Ładowanie zadań…</p> : loadError ?
      <p className="form-error" role="alert">{loadError}</p> : <>
      {attached.length === 0 && <p className="empty-state">Przypnij zadania, które pomogą Ci osiągnąć ten cel.</p>}
      {attached.length > 0 && <ul className="task-list goal-linked-tasks">
        {attached.map(task => <li key={task.id} className="goal-linked-task">
          <input type="checkbox" checked={task.completed} disabled={disabled}
            aria-label={`Wykonane: ${task.title}`} onChange={() => void run(async () => {
              await onToggleTask(task.id)
              setAttached(current => current.map(item => item.id === task.id
                ? { ...item, completed: !item.completed }
                : item))
            })} />
          <span className={task.completed ? 'goal-task-completed' : undefined}>{task.title}</span>
          <span className="task-points">{task.points} pkt</span>
          <button type="button" className="secondary-button" disabled={disabled}
            aria-label={`Odepnij zadanie: ${task.title}`} onClick={() => void run(async () => {
              await setGoalTask(goalId, task.id, false)
              setAttached(current => current.filter(item => item.id !== task.id))
            })}>Odepnij</button>
        </li>)}
      </ul>}
      <button ref={trigger} type="button" className="secondary-button add-task-toggle" disabled={disabled || pickerOpen}
        onClick={() => { setError(''); setPickerLoading(true); setPickerOpen(true) }}>Przypnij zadanie</button>
      {pickerOpen && <div className="task-form goal-task-picker">
        <label className="form-field"><span>Wyszukaj zadanie</span>
          <input ref={searchInput} type="search" value={queryInput} disabled={disabled}
            placeholder="Wpisz tytuł zadania" onChange={event => setQueryInput(event.target.value)} />
        </label>

        {!pickerLoading && priorityTasks.length > 0 && <section className="goal-available-section">
          <h4>Moje priorytety</h4>{availableList(priorityTasks)}
        </section>}
        {!pickerLoading && backlogTasks.length > 0 && <section className="goal-available-section">
          <h4>Pozostałe zadania</h4>{availableList(backlogTasks)}
        </section>}
        {!pickerLoading && active.length === 0 && <p className="empty-state">
          {query ? 'Nie znaleziono aktywnych zadań.' : 'Brak aktywnych zadań do przypięcia.'}
        </p>}
        {activeHasMore && <button type="button" className="goal-picker-link" disabled={disabled}
          onClick={() => void loadMore(false)}>Pokaż więcej aktywnych</button>}

        <button type="button" className="goal-picker-link" disabled={disabled} onClick={() => {
          setPickerLoading(true)
          setShowCompleted(current => !current)
          if (showCompleted) setCompleted([])
        }}>{showCompleted ? 'Ukryj wykonane' : 'Pokaż wykonane'}</button>
        {showCompleted && !pickerLoading && <section className="goal-available-section">
          <h4>Wykonane zadania</h4>
          {completed.length > 0 ? availableList(completed) : <p className="empty-state">
            {query ? 'Nie znaleziono wykonanych zadań.' : 'Brak wykonanych zadań do przypięcia.'}
          </p>}
          {completedHasMore && <button type="button" className="goal-picker-link" disabled={disabled}
            onClick={() => void loadMore(true)}>Pokaż więcej wykonanych</button>}
        </section>}
        {pickerLoading && <p role="status">Ładowanie zadań…</p>}
        <button type="button" className="secondary-button goal-picker-close" disabled={busy} onClick={closePicker}>Zamknij</button>
      </div>}
      {busy && <p role="status">Zapisywanie…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </>}
  </div>
}
