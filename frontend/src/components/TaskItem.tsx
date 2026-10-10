import { useEffect, useId, useRef, useState } from 'react'
import type { Task } from '../types/Task'
import EditTaskForm from './EditTaskForm'
import TaskActionsMenu from './TaskActionsMenu'

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
  const titleId = useId()
  const checkboxId = useId()
  const card = useRef<HTMLLIElement>(null)
  const wasEditing = useRef(isEditing)
  const disabled = isAnyTaskEditing || isSaving
  const variant = task.completed ? 'completed' : task.inFocus ? 'focus' : 'backlog'

  useEffect(() => {
    if (wasEditing.current && !isEditing) {
      card.current?.querySelector<HTMLButtonElement>('.task-menu-trigger')?.focus()
    }
    wasEditing.current = isEditing
  }, [isEditing])

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
    <li ref={card} className={`task-card task-card-${variant}${isEditing ? ' task-card-editing' : ''}`} aria-busy={isSaving}>
      {isEditing ? (
        <EditTaskForm task={task} onSave={onSave} onCancel={onCancel} />
      ) : (
        <>
          {variant === 'focus' && (
            <label className="task-card-check" htmlFor={checkboxId}>
              <input
                id={checkboxId}
                type="checkbox"
                aria-labelledby={titleId}
                checked={task.completed}
                disabled={disabled}
                onChange={() => void saveChange(onToggleTask)}
              />
            </label>
          )}
          {variant === 'focus' ? (
            <label className="task-card-title" id={titleId} htmlFor={checkboxId}>{task.title}</label>
          ) : (
            <span className="task-card-title" id={titleId}>{task.title}</span>
          )}
          <span className="task-points task-card-points">{task.points} pkt</span>
          {variant === 'backlog' && (
            <button
              type="button"
              className="secondary-button task-card-primary"
              disabled={disabled}
              onClick={() => void saveChange(onToggleFocus)}
              aria-label={`Przenieś do priorytetów: ${task.title}`}
            >
              Do priorytetów
            </button>
          )}
          {task.completed && (
            <button
              type="button"
              className="secondary-button task-card-primary"
              disabled={disabled}
              onClick={() => void saveChange(onToggleTask)}
              aria-label={`Cofnij ukończenie: ${task.title}`}
            >
              Cofnij ukończenie
            </button>
          )}
          <TaskActionsMenu
            itemTitle={task.title}
            disabled={disabled}
            actions={[
              ...(!task.completed ? [{ label: 'Edytuj', onSelect: () => onStartEditing(task.id) }] : []),
              ...(variant === 'focus' ? [{ label: 'Przenieś do pozostałych zadań', onSelect: () => void saveChange(onToggleFocus) }] : []),
              {
                label: 'Usuń',
                destructive: true,
                onSelect: () => void saveChange(onDelete, 'Nie udało się usunąć zadania. Sprawdź połączenie z backendem i spróbuj ponownie.'),
              },
            ]}
          />
        </>
      )}
      {isSaving && <span className="task-card-status" role="status">Zapisywanie…</span>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </li>
  )
}

export default TaskItem
