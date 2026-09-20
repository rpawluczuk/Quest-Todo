import type { ReactNode } from 'react'
import type { Task } from '../types/Task'
import TaskItem from './TaskItem'

type TaskSectionProps = {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly emptyMessage: string
  readonly tasks: readonly Task[]
  readonly editingTaskId: number | null
  readonly onToggleTask: (taskId: number) => void
  readonly onToggleFocus: (taskId: number) => void
  readonly onStartEditing: (taskId: number) => void
  readonly onSave: (title: string, points: number) => void
  readonly onCancel: () => void
  readonly children?: ReactNode
}

function TaskSection({
  id,
  title,
  description,
  emptyMessage,
  tasks,
  editingTaskId,
  onToggleTask,
  onToggleFocus,
  onStartEditing,
  onSave,
  onCancel,
  children,
}: TaskSectionProps) {
  return (
    <section className="tasks-section" aria-labelledby={`${id}-heading`}>
      <div className="section-header">
        <h2 id={`${id}-heading`} lang="en">{title} ({tasks.length})</h2>
        <p>{description}</p>
      </div>
      {children}
      {tasks.length === 0 && <p className="empty-state">{emptyMessage}</p>}
      <ul className="task-list">
        {tasks.map((task) => (
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
          />
        ))}
      </ul>
    </section>
  )
}

export default TaskSection
