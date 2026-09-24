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
  const { id, title, description, emptyMessage, tasks } = section
  const isCompletedSection = id === 'completed'
  const [expanded, setExpanded] = useState(false)
  const [visibleCount, setVisibleCount] = useState(10)
  const showTasks = !isCompletedSection || expanded
  const visibleTasks = isCompletedSection ? tasks.slice(0, visibleCount) : tasks

  return (
    <section className="tasks-section" aria-labelledby={`${id}-heading`}>
      <div className="section-header">
        <h2 id={`${id}-heading`} lang={isCompletedSection ? 'pl' : 'en'}>
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
          ) : <>{title} ({tasks.length})</>}
        </h2>
        {showTasks && <p>{description}</p>}
      </div>
      <div id={`${id}-content`} hidden={!showTasks}>
        {children}
        {tasks.length === 0 && <p className="empty-state">{emptyMessage}</p>}
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
