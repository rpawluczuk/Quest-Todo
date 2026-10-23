import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { getAvailableGoalTasks, getGoalTasks, setGoalTask } from '../api/goalApi'
import type { Task } from '../types/Task'
import TaskActionsMenu from './TaskActionsMenu'
import { getTaskDuePresentation } from '../taskDue'
import type { GoalSectionActionHandle, GoalSectionActionProps } from './GoalSectionAction'

export type GoalTasksProps = {
  taskRevision: number
  tasksDisabled: boolean
  onToggleTask: (id: number) => Promise<void>
  onGoalLinksChanged: () => void
}

function mergeTasks(current: Task[], next: Task[]): Task[] {
  const known = new Set(current.map(task => task.id))
  return [...current, ...next.filter(task => !known.has(task.id))]
}

const GoalTasks = forwardRef<GoalSectionActionHandle, GoalTasksProps & {
  goalId: number; goalTitle: string; onCountChange?: (goalId: number, count: number) => void
} & GoalSectionActionProps>(function GoalTasks({ goalId, goalTitle, taskRevision, tasksDisabled, onToggleTask,
  onGoalLinksChanged, onCountChange, actionTriggerRef, onActionDisabledChange }, ref) {
  const [attached, setAttached] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<Task[]>([])
  const [activeHasMore, setActiveHasMore] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [completed, setCompleted] = useState<Task[]>([])
  const [completedHasMore, setCompletedHasMore] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const searchInput = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getGoalTasks(goalId, controller.signal).then(loaded => {
      if (!controller.signal.aborted) setAttached(loaded)
    }).catch(failure => {
      if (!controller.signal.aborted) setLoadError(failure instanceof Error ? failure.message : 'Nie udało się pobrać zadań celu.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [goalId, taskRevision])

  useEffect(() => { onCountChange?.(goalId, attached.length) }, [attached.length, goalId, onCountChange])

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
      if (controller.signal.aborted) return
      setActive(result.tasks)
      setActiveHasMore(result.hasMore)
    })]
    if (showCompleted) requests.push(getAvailableGoalTasks(goalId, true, query, 0, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setCompleted(result.tasks)
      setCompletedHasMore(result.hasMore)
    }))
    Promise.all(requests).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Nie udało się pobrać zadań do przypięcia.')
    }).finally(() => { if (!controller.signal.aborted) setPickerLoading(false) })
    return () => controller.abort()
  }, [goalId, pickerOpen, query, showCompleted, retry])

  useEffect(() => {
    if (!pickerOpen) return
    const element = dialog.current
    element?.showModal()
    searchInput.current?.focus()
    return () => element?.close()
  }, [pickerOpen])

  const disabled = busy || tasksDisabled || pageLoading
  const actionDisabled = loading || !!loadError || disabled || pickerOpen
  useImperativeHandle(ref, () => ({
    activate: () => {
      if (actionDisabled) return
      setError('')
      setPickerLoading(true)
      setPickerOpen(true)
    },
  }), [actionDisabled])
  useEffect(() => {
    onActionDisabledChange?.(goalId, 'tasks', actionDisabled)
  }, [actionDisabled, goalId, onActionDisabledChange])
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
    if (sending.current || busy) return
    dialog.current?.close()
    setPickerOpen(false)
    setQueryInput('')
    setQuery('')
    setShowCompleted(false)
    setActive([])
    setCompleted([])
    setError('')
    setNotice('')
    requestAnimationFrame(() => actionTriggerRef?.current?.focus())
  }

  function attach(task: Task) {
    if (task.goalId != null && task.goalId !== goalId &&
      !window.confirm(`Zadanie „${task.title}” jest przypisane do celu „${task.goalTitle}”. Przenieść je do celu „${goalTitle}”?`)) {
      return
    }
    void run(async () => {
      await setGoalTask(goalId, task.id, true)
      setAttached(current => mergeTasks(current, [{ ...task, goalId, goalTitle }]))
      onGoalLinksChanged()
      setNotice(`Przypięto: ${task.title}`)
    })
  }

  async function loadMore(isCompleted: boolean) {
    if (sending.current) return
    sending.current = true
    setPageLoading(true)
    setError('')
    const current = isCompleted ? completed : active
    // Attached rows remain visible, but the server excludes them. Recalculate the
    // offset from remaining candidates so attaching cannot skip a page of tasks.
    const remaining = current.filter(task => !attached.some(item => item.id === task.id))
    const nextPage = Math.floor(remaining.length / 20)
    try {
      let result = await getAvailableGoalTasks(goalId, isCompleted, query, nextPage)
      if (result.hasMore && result.tasks.every(task => current.some(item => item.id === task.id))) {
        result = await getAvailableGoalTasks(goalId, isCompleted, query, nextPage + 1)
      }
      if (isCompleted) {
        setCompleted(current => mergeTasks(current, result.tasks))
        setCompletedHasMore(result.hasMore)
      } else {
        setActive(current => mergeTasks(current, result.tasks))
        setActiveHasMore(result.hasMore)
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się pobrać kolejnych zadań.')
    } finally { sending.current = false; setPageLoading(false) }
  }

  function availableList(tasks: Task[]) {
    return <ul className="goal-available-list">{tasks.map(task => <li key={task.id} className="goal-available-task">
      <span className="goal-available-task-title">{task.title}
        {task.goalTitle && <small>Obecny cel: {task.goalTitle}</small>}
      </span>
      {attached.some(item => item.id === task.id) ? <span className="goal-picker-attached">✓ Przypięto</span> :
        <button type="button" className="goal-picker-link" disabled={disabled || pickerLoading}
          aria-label={`${task.goalId ? 'Przenieś' : 'Przypnij'} zadanie: ${task.title}`} onClick={() => attach(task)}>
          {task.goalId ? 'Przenieś' : 'Przypnij'}
        </button>}
    </li>)}</ul>
  }

  return <div className="goal-tasks" id={`goal-tasks-${goalId}`}>
    {loading ? <p role="status">Ładowanie zadań…</p> : loadError ?
      <p className="form-error" role="alert">{loadError}</p> : <>
      {attached.length === 0 && <p className="empty-state">Przypnij zadania, które pomogą Ci osiągnąć ten cel.</p>}
      {attached.length > 0 && <ul className="task-list goal-linked-tasks">
        {attached.map(task => {
          const due = getTaskDuePresentation(task)
          return <li key={task.id} className="goal-linked-task">
          <input type="checkbox" checked={task.completed} disabled={disabled}
            aria-label={`Wykonane: ${task.title}`} onChange={() => void run(async () => {
              await onToggleTask(task.id)
            })} />
          <span className={`goal-linked-item-title${task.completed ? ' goal-task-completed' : ''}`}>{task.title}</span>
          <div className="goal-linked-item-meta">
            {due && <span className={`goal-linked-task-due${due.overdue ? ' task-card-due-overdue' : ''}`}>{due.label}</span>}
            <span className="task-points task-card-points">{task.points} pkt</span>
          </div>
          <TaskActionsMenu itemTitle={task.title} disabled={disabled} actions={[{
            label: 'Odepnij od celu', onSelect: () => void run(async () => {
              await setGoalTask(goalId, task.id, false)
              setAttached(current => current.filter(item => item.id !== task.id))
              onGoalLinksChanged()
            }),
          }]} />
        </li>})}
      </ul>}
      {pickerOpen && <dialog ref={dialog} className="password-dialog goal-picker-dialog" aria-labelledby="goal-picker-title"
        onCancel={event => { event.preventDefault(); closePicker() }}>
        <div className="goal-picker-header">
        <button type="button" className="password-dialog-close" aria-label="Zamknij" disabled={busy || pageLoading} onClick={closePicker}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
        <h2 id="goal-picker-title">Przypnij zadania</h2>
        <p className="goal-picker-context">Do celu: {goalTitle}</p>
        <label className="form-field"><span>Wyszukaj zadanie</span>
          <input ref={searchInput} type="search" value={queryInput} disabled={disabled}
            placeholder="Wpisz tytuł zadania" onChange={event => { setError(''); setQueryInput(event.target.value) }} />
        </label>
        </div>
        <div className="goal-picker-results" aria-busy={pickerLoading}>
        {!pickerLoading && priorityTasks.length > 0 && <section className="goal-available-section">
          <h4>Moje priorytety</h4>{availableList(priorityTasks)}
        </section>}
        {!pickerLoading && backlogTasks.length > 0 && <section className="goal-available-section">
          <h4>Pozostałe zadania</h4>{availableList(backlogTasks)}
        </section>}
        {!pickerLoading && active.length === 0 && <p className="empty-state">
          {query ? 'Nie znaleziono aktywnych zadań.' : 'Brak aktywnych zadań do przypięcia.'}
        </p>}
        {activeHasMore && <button type="button" className="goal-picker-link" disabled={disabled || pickerLoading}
          onClick={() => void loadMore(false)}>Pokaż więcej aktywnych</button>}

        <button type="button" className="goal-picker-link" disabled={disabled || pickerLoading} onClick={() => {
          setError('')
          setPickerLoading(true)
          setShowCompleted(current => !current)
          if (showCompleted) setCompleted([])
        }}>{showCompleted ? 'Ukryj wykonane' : 'Pokaż wykonane'}</button>
        {showCompleted && !pickerLoading && <section className="goal-available-section">
          <h4>Wykonane zadania</h4>
          {completed.length > 0 ? availableList(completed) : <p className="empty-state">
            {query ? 'Nie znaleziono wykonanych zadań.' : 'Brak wykonanych zadań do przypięcia.'}
          </p>}
          {completedHasMore && <button type="button" className="goal-picker-link" disabled={disabled || pickerLoading}
            onClick={() => void loadMore(true)}>Pokaż więcej wykonanych</button>}
        </section>}
        {(pickerLoading || pageLoading) && <p role="status">Ładowanie zadań…</p>}
        </div>
        <div className="goal-picker-footer">
          <p className="goal-picker-notice" role="status">{busy ? 'Zapisywanie…' : notice}</p>
          {error && <div><p className="form-error" role="alert">{error}</p>
            <button type="button" className="goal-picker-link" disabled={busy || pickerLoading} onClick={() => {
              setError(''); setPickerLoading(true); setRetry(value => value + 1)
            }}>Odśwież listę</button></div>}
          <button type="button" className="goal-picker-close" disabled={busy || pageLoading} onClick={closePicker}>Gotowe</button>
        </div>
      </dialog>}
      {!pickerOpen && busy && <p role="status">Zapisywanie…</p>}
      {!pickerOpen && error && <p className="form-error" role="alert">{error}</p>}
    </>}
  </div>
})

export default GoalTasks
