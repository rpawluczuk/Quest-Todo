import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getTaskHistory } from '../api/taskApi'
import type { Task } from '../types/Task'
import type { TaskSectionData } from '../types/TaskSectionData'
import TaskItem from './TaskItem'

type TaskSectionProps = {
  readonly history?: { count: number; revision: number; onCount: (count: number) => void }
  readonly section: TaskSectionData
  readonly editingTaskId: number | null
  readonly onToggleTask: (taskId: number) => Promise<void>
  readonly onToggleFocus: (taskId: number) => Promise<void>
  readonly onStartEditing: (taskId: number) => void
  readonly onSave: (title: string, points: number, description: string, dueDate: string, dueTime: string,
    categoryId: number | null, goalIds: number[]) => Promise<void>
  readonly onCancel: () => void
  readonly onDelete: (taskId: number) => Promise<void>
  readonly children?: ReactNode
}

function TargetIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2M22 12h-2M12 22v-2M2 12h2" />
  </svg>
}

function TaskListIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="m7 9 1.5 1.5L11 8M13 9h4M7 15h2M13 15h4" />
  </svg>
}

function EmptyStateIcon({ icon }: { icon: 'target' | 'list' }) {
  return <span className="task-empty-icon">{icon === 'target' ? <TargetIcon /> : <TaskListIcon />}</span>
}

function TaskSection({
  section,
  editingTaskId,
  onToggleTask,
  onToggleFocus,
  onStartEditing,
  onSave,
  onCancel,
  onDelete,
  children,
  history,
}: TaskSectionProps) {
  const { id, title, description, emptyState, tasks } = section
  const isCompletedSection = id === 'completed'
  const [expanded, setExpanded] = useState(false)
  const [historyTasks, setHistoryTasks] = useState<Task[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const request = useRef(0)
  const onCount = history?.onCount
  useEffect(() => {
    if (!isCompletedSection || !expanded) return
    const controller = new AbortController()
    const version = ++request.current
    // Loading state belongs to this network request, including mutation-triggered reloads.
    // oxlint-disable-next-line react/set-state-in-effect
    setBusy(true)
    setError('')
    getTaskHistory(0, controller.signal).then(result => {
      if (controller.signal.aborted || version !== request.current) return
      setHistoryTasks(result.tasks)
      setPage(0)
      setHasMore(result.hasMore)
      onCount?.(result.total)
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message)
    }).finally(() => { if (!controller.signal.aborted && version === request.current) setBusy(false) })
    // This is a request generation counter, not a DOM ref: invalidate pending pages on cleanup.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    return () => { controller.abort(); request.current++ }
  }, [isCompletedSection, expanded, history?.revision, retry, onCount])

  async function more() {
    if (busy) return
    const version = ++request.current
    setBusy(true)
    setError('')
    try {
      const result = await getTaskHistory(page + 1)
      if (version !== request.current) return
      setHistoryTasks(current => [...current, ...result.tasks.filter(task => !current.some(item => item.id === task.id))])
      setPage(current => current + 1)
      setHasMore(result.hasMore)
      onCount?.(result.total)
    } catch (failure) {
      if (version === request.current) setError(failure instanceof Error ? failure.message : 'Nie udało się pobrać historii.')
    } finally { if (version === request.current) setBusy(false) }
  }
  const showTasks = !isCompletedSection || expanded
  const visibleTasks = isCompletedSection ? historyTasks : tasks

  return (
    <section className="tasks-section" aria-labelledby={`${id}-heading`}>
      <div className="section-header">
        <h2 id={`${id}-heading`} lang="pl" className={isCompletedSection ? undefined : 'task-section-title'}>
          {isCompletedSection ? (
            <button
              type="button"
              className="completed-toggle"
              aria-expanded={expanded}
              aria-controls="completed-content"
              onClick={() => {
                setExpanded(!expanded)
              }}
            >
              <span aria-hidden="true">{expanded ? '▾' : '▸'}</span> {title} ({history?.count ?? tasks.length})
            </button>
          ) : <><span>{title}</span><span className="task-section-count" aria-label={`Liczba zadań: ${tasks.length}`}>{tasks.length}</span></>}
        </h2>
        {showTasks && <p>{description}</p>}
      </div>
      <div id={`${id}-content`} hidden={!showTasks}>
        {tasks.length === 0 && emptyState.prominent ? (
          <div className="task-empty-state task-empty-state-prominent">
            {emptyState.icon && <EmptyStateIcon icon={emptyState.icon} />}
            <p className="empty-state">{emptyState.message}</p>
            {children}
          </div>
        ) : <>
          {children}
          {!isCompletedSection && tasks.length === 0 && <div className={`task-empty-state${emptyState.centered ? ' task-empty-state-centered' : ''}`}>
            {emptyState.icon && <EmptyStateIcon icon={emptyState.icon} />}
            <p className="empty-state">{emptyState.message}</p>
          </div>}
        </>}
        <ul className="task-list">
          {visibleTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              goalTitles={task.goalTitles ?? []}
              isEditing={editingTaskId === task.id}
              isAnyTaskEditing={editingTaskId !== null}
              onToggleTask={onToggleTask}
              onToggleFocus={onToggleFocus}
              onStartEditing={onStartEditing}
              onSave={onSave}
              onCancel={onCancel}
              onDelete={onDelete}
            />
          ))}
        </ul>
        {isCompletedSection && busy && <p role="status">Ładowanie historii…</p>}
        {isCompletedSection && error && <div><p className="form-error" role="alert">{error}</p>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => setRetry(value => value + 1)}>Spróbuj ponownie</button></div>}
        {isCompletedSection && !busy && !error && historyTasks.length === 0 && <p className="empty-state">{emptyState.message}</p>}
        {isCompletedSection && hasMore && !error && <button type="button" className="secondary-button show-more" disabled={busy} onClick={() => void more()}>Pokaż więcej</button>}
      </div>
    </section>
  )
}

export default TaskSection
