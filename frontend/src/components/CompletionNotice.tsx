import { useRef, useState } from 'react'
import type { Task } from '../types/Task'

type CompletionNoticeProps = {
  readonly task: Task
  readonly onUndo: (taskId: number) => Promise<void>
  readonly onDismiss: () => void
}

export default function CompletionNotice({ task, onUndo, onDismiss }: CompletionNoticeProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)

  async function undo() {
    if (saving.current) return
    saving.current = true
    setBusy(true)
    setError('')
    try {
      await onUndo(task.id)
    } catch {
      setError('Nie udało się cofnąć ukończenia. Spróbuj ponownie.')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  return (
    <aside className="completion-notice" aria-label="Ostatnio ukończone zadanie">
      <p role="status">Zadanie ukończone: <strong>{task.title}</strong></p>
      <div className="task-actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void undo()}>
          {busy ? 'Cofanie…' : 'Cofnij'}
        </button>
        <button type="button" className="secondary-button" disabled={busy} onClick={onDismiss} aria-label="Zamknij powiadomienie">
          Zamknij
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </aside>
  )
}
