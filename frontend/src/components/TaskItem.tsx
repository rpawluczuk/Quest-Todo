import { useRef, useState } from 'react'
import type { Task } from '../types/Task'
import EditTaskForm from './EditTaskForm'

type TaskItemProps = {
  readonly task: Task
  readonly isEditing: boolean
  readonly isAnyTaskEditing: boolean
  readonly onToggleTask: (taskId: number) => Promise<void>
  readonly onToggleFocus: (taskId: number) => Promise<void>
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
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const savingRef = useRef(false)

  async function saveChange(action: (taskId: number) => Promise<void>) {
    if (savingRef.current) return
    savingRef.current = true
    setIsSaving(true)
    setError('')
    try {
      await action(task.id)
    } catch {
      setError('Nie udało się zapisać zmiany. Sprawdź połączenie z backendem i spróbuj ponownie.')
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

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
              disabled={isSaving}
              onChange={() => void saveChange(onToggleTask)}
            />
            <span className="task-title">{task.title}</span>
          </label>
          <div className="task-actions">
            <span className="task-points">{task.points} pkt</span>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void saveChange(onToggleFocus)}
              disabled={isAnyTaskEditing || isSaving}
              aria-label={`${task.inFocus ? 'Przenieś do Backlogu' : 'Przenieś do Focus'}: ${task.title}`}
            >
              {task.inFocus ? 'Przenieś do Backlogu' : 'Przenieś do Focus'}
            </button>
            {!task.completed && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => onStartEditing(task.id)}
                disabled={isAnyTaskEditing || isSaving}
                aria-label={`Edytuj zadanie: ${task.title}`}
              >
                Edytuj
              </button>
            )}
          </div>
        </>
      )}
      {isSaving && <span role="status">Zapisywanie…</span>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </li>
  )
}

export default TaskItem
