import { useState, type ReactNode } from 'react'
import type { TaskSectionData } from '../types/TaskSectionData'
import TaskItem from './TaskItem'

type TaskSectionProps = {
  readonly section: TaskSectionData
  readonly editingTaskId: number | null
  readonly onToggleTask: (taskId: number) => Promise<void>
  readonly onToggleFocus: (taskId: number) => Promise<void>
  readonly onStartEditing: (taskId: number) => void
  readonly onSave: (title: string, points: number) => Promise<void>
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
}: TaskSectionProps) {
  const { id, title, description, emptyState, tasks } = section
  const isCompletedSection = id === 'completed'
  const [expanded, setExpanded] = useState(false)
  const [visibleCount, setVisibleCount] = useState(10)
  const showTasks = !isCompletedSection || expanded
  const visibleTasks = isCompletedSection ? tasks.slice(0, visibleCount) : tasks

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
                setVisibleCount(10)
              }}
            >
              <span aria-hidden="true">{expanded ? '▾' : '▸'}</span> {title} ({tasks.length})
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
          {tasks.length === 0 && <div className={`task-empty-state${emptyState.centered ? ' task-empty-state-centered' : ''}`}>
            {emptyState.icon && <EmptyStateIcon icon={emptyState.icon} />}
            <p className="empty-state">{emptyState.message}</p>
          </div>}
        </>}
        <ul className="task-list">
          {visibleTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
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
        {isCompletedSection && visibleCount < tasks.length && (
          <button type="button" className="secondary-button show-more" onClick={() => setVisibleCount((count) => count + 10)}>
            Pokaż więcej ({tasks.length - visibleCount} pozostałych)
          </button>
        )}
      </div>
    </section>
  )
}

export default TaskSection
