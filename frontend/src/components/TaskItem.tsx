import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import type { Task } from '../types/Task'
import EditTaskForm from './EditTaskForm'
import TaskActionsMenu from './TaskActionsMenu'
import { getTaskDuePresentation } from '../taskDue'

type TaskItemProps = {
  readonly task: Task
  readonly goalTitles: readonly string[]
  readonly isEditing: boolean
  readonly isAnyTaskEditing: boolean
  readonly onToggleTask: (taskId: number) => Promise<void>
  readonly onToggleFocus: (taskId: number) => Promise<void>
  readonly onStartEditing: (taskId: number) => void
  readonly onSave: (title: string, points: number, description: string, dueDate: string, dueTime: string) => Promise<void>
  readonly onCancel: () => void
  readonly onDelete: (taskId: number) => Promise<void>
}

function TaskItem({
  task,
  goalTitles,
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
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const savingRef = useRef(false)
  const checkboxId = useId()
  const descriptionId = useId()
  const titleButton = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLLIElement>(null)
  const wasEditing = useRef(isEditing)
  const disabled = isAnyTaskEditing || isSaving
  const variant = task.completed ? 'completed' : task.inFocus ? 'focus' : 'backlog'
  const due = getTaskDuePresentation(task)

  useEffect(() => {
    if (wasEditing.current && !isEditing) {
      requestAnimationFrame(() =>
        (titleButton.current ?? card.current?.querySelector<HTMLButtonElement>('.task-menu-trigger'))?.focus(),
      )
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
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : errorMessage)
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  function toggleDescription() {
    if (task.description && !disabled) setDescriptionExpanded(expanded => !expanded)
  }

  async function saveDetails(title: string, points: number, description: string, dueDate: string, dueTime: string) {
    await onSave(title, points, description, dueDate, dueTime)
    setDescriptionExpanded(false)
  }

  function handleCardClick(event: MouseEvent<HTMLLIElement>) {
    if (!(event.target instanceof Element) ||
      event.target.closest('button, input, label, textarea, select, a, form, [role="button"]')) return
    toggleDescription()
  }

  return (
    <li ref={card} className={`task-card task-card-${variant}${isEditing ? ' task-card-editing' : ''}${task.description && !disabled ? ' task-card-has-note' : ''}`}
      aria-busy={isSaving} onClick={handleCardClick}>
      {isEditing ? <EditTaskForm task={task} onSave={saveDetails} onCancel={onCancel} /> : <>
          {variant === 'focus' && (
            <label className="task-card-check" htmlFor={checkboxId}>
              <input
                id={checkboxId}
                type="checkbox"
                aria-label={`Wykonane: ${task.title}`}
                checked={task.completed}
                disabled={disabled}
                onChange={() => void saveChange(onToggleTask)}
              />
            </label>
          )}
          {task.description ? <button ref={titleButton} type="button" className="task-card-title"
            disabled={disabled} onClick={toggleDescription} aria-expanded={descriptionExpanded}
            aria-controls={descriptionId} aria-label={`${descriptionExpanded ? 'Ukryj' : 'Pokaż'} notatkę: ${task.title}`}>
            <span>{task.title}</span>
            <svg className="task-note-icon" viewBox="0 0 20 20" fill="none"
              stroke="currentColor" strokeWidth="1.5" aria-label="Zawiera notatkę" role="img">
              <path d="M5 2.5h7l3 3V17H5zM12 2.5v3h3M7.5 9h5M7.5 12h5" />
            </svg>
          </button> : <span className="task-card-title"><span>{task.title}</span></span>}
          {goalTitles.length > 0 && <p className="task-card-goals">
            <span className="task-card-goals-label">{goalTitles.length === 1 ? 'Cel:' : 'Cele:'}</span>{' '}
            <span>{goalTitles.join(' · ')}</span>
          </p>}
          <div className={`task-card-footer${variant === 'backlog' ? ' task-card-footer-with-action' : ''}`}>
            <span className="task-card-meta">
              {due && <span className={`task-card-due${due.overdue ? ' task-card-due-overdue' : ''}`}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
                  <path d="M6.5 2.5v4M13.5 2.5v4M3 8h14" />
                </svg>
                <span>{due.label}</span>
              </span>}
              <span className="task-points task-card-points">{task.points} pkt</span>
            </span>
            {variant === 'backlog' && (
              <button
                type="button"
                className="task-card-priority-action"
                disabled={disabled}
                onClick={() => void saveChange(onToggleFocus)}
                aria-label={`Przenieś do priorytetów: ${task.title}`}
              >
                <span>Do priorytetów</span>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <path d="M10 15V5M6 9l4-4 4 4" />
                </svg>
              </button>
            )}
          </div>
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
          {task.description && <p id={descriptionId} className="task-card-description" hidden={!descriptionExpanded}>{task.description}</p>}
      </>}
      {isSaving && <span className="task-card-status" role="status">Zapisywanie…</span>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </li>
  )
}

export default TaskItem
