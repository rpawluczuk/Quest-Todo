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
  readonly onDelete: (taskId: number) => Promise<void>
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
  onDelete,
}: TaskItemProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const savingRef = useRef(false)

  async function saveChange(
    action: (taskId: number) => Promise<void>,
    errorMessage = 'Nie udało się zapisać zmiany. Sprawdź połączenie z backendem i spróbuj ponownie.',
  ) {
    if (savingRef.current) return
    savingRef.current = true
    setIsSaving(true)
    setError('')
    try {
      await action(task.id)
    } catch {
      setError(errorMessage)
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
          {task.completed ? (
            <span className="task-title">{task.title}</span>
          ) : (
            <label className="task-label">
              <input
                type="checkbox"
                checked={task.completed}
                disabled={isSaving}
                onChange={() => void saveChange(onToggleTask)}
              />
              <span className="task-title">{task.title}</span>
            </label>
          )}
          <div className="task-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={isAnyTaskEditing || isSaving}
              onClick={() => void saveChange(onDelete, 'Nie udało się usunąć zadania. Sprawdź połączenie z backendem i spróbuj ponownie.')}
              aria-label={`Usuń zadanie: ${task.title}`}
              title="Usuń zadanie"
            >
              Usuń
            </button>
            <span className="task-points">{task.points} pkt</span>
            {task.completed ? (
              <button
                type="button"
                className="secondary-button"
                disabled={isAnyTaskEditing || isSaving}
                onClick={() => void saveChange(onToggleTask)}
                aria-label={`Cofnij ukończenie: ${task.title}`}
              >
                Cofnij ukończenie
              </button>
            ) : (
              <button
                type="button"
                className="secondary-button"
                onClick={() => void saveChange(onToggleFocus)}
                disabled={isAnyTaskEditing || isSaving}
                aria-label={`${task.inFocus ? 'Przenieś do Backlogu' : 'Przenieś do Focus'}: ${task.title}`}
              >
                {task.inFocus ? 'Przenieś do Backlogu' : 'Przenieś do Focus'}
              </button>
            )}
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
