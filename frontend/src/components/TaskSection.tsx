import type { ReactNode } from 'react'
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
  children,
}: TaskSectionProps) {
  const { id, title, description, emptyMessage, tasks } = section

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
