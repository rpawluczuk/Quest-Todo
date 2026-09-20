import type { Task } from '../types/Task'
import EditTaskForm from './EditTaskForm'

type TaskItemProps = {
  readonly task: Task
  readonly isEditing: boolean
  readonly isAnyTaskEditing: boolean
  readonly onToggleTask: (taskId: number) => void
  readonly onToggleFocus: (taskId: number) => void
  readonly onStartEditing: (taskId: number) => void
  readonly onSave: (title: string, points: number) => Promise<void>
  readonly onCancel: () => void
}

function TaskItem({
  task,
  isEditing,
  isAnyTaskEditing,
  onToggleTask,
  onToggleFocus,
  onStartEditing,
  onSave,
  onCancel,
}: TaskItemProps) {
  return (
    <li className={task.completed ? 'task task-completed' : 'task'}>
      {isEditing ? (
        <EditTaskForm task={task} onSave={onSave} onCancel={onCancel} />
      ) : (
        <>
          <label className="task-label">
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => onToggleTask(task.id)}
            />
            <span className="task-title">{task.title}</span>
          </label>
          <div className="task-actions">
            <span className="task-points">{task.points} pkt</span>
            <button
              type="button"
              className="secondary-button"
              onClick={() => onToggleFocus(task.id)}
              disabled={isAnyTaskEditing}
              aria-label={`${task.inFocus ? 'Przenieś do Backlogu' : 'Przenieś do Focus'}: ${task.title}`}
            >
              {task.inFocus ? 'Przenieś do Backlogu' : 'Przenieś do Focus'}
            </button>
            {!task.completed && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => onStartEditing(task.id)}
                disabled={isAnyTaskEditing}
                aria-label={`Edytuj zadanie: ${task.title}`}
              >
                Edytuj
              </button>
            )}
          </div>
        </>
      )}
    </li>
  )
}

export default TaskItem
