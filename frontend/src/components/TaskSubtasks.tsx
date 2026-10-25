import { useEffect, useId, useRef, useState } from 'react'
import { CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react'
import { getSubtasks } from '../api/subtaskApi'
import type { Subtask } from '../types/Subtask'

type Props = { taskId: number; total: number; completed: number }

// Cache is scoped to this task card. Its parent resets it when server counts change.
export default function TaskSubtasks({ taskId, total, completed }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [items, setItems] = useState<Subtask[] | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const request = useRef<Promise<Subtask[]> | null>(null)
  const listId = useId()

  useEffect(() => {
    if (!expanded || items) return
    let active = true
    // Retain the pending/resolved promise across rapid collapse/expand and StrictMode.
    request.current ??= getSubtasks(taskId)
    void request.current.then(data => {
      if (active) setItems(data)
    }, failure => {
      request.current = null
      if (active) setError(failure instanceof Error ? failure.message : 'Nie udało się pobrać podzadań.')
    })
    return () => { active = false }
  }, [expanded, items, retry, taskId])

  const count = items?.length ?? total
  const done = items?.filter(item => item.completed).length ?? completed
  const Chevron = expanded ? ChevronUp : ChevronDown

  return <div className="task-subtasks" onClick={event => event.stopPropagation()}>
    <button type="button" className="task-subtasks-toggle" aria-expanded={expanded} aria-controls={listId}
      onClick={() => { setError(''); setExpanded(value => !value) }}>
      <CheckSquare size={16} aria-hidden="true" />
      <span>{done}/{count} podzadań</span>
      <Chevron size={16} aria-hidden="true" />
    </button>
    <div id={listId} hidden={!expanded}>
      {expanded && !items && !error && <p className="task-subtasks-message" role="status">Ładowanie podzadań…</p>}
      {expanded && error && <div className="task-subtasks-message">
        <span role="alert">{error}</span>
        <button type="button" className="task-subtasks-retry" onClick={() => { setError(''); setRetry(value => value + 1) }}>
          Spróbuj ponownie
        </button>
      </div>}
      {items && <ul className="task-subtasks-list">
        {items.map(item => <li key={item.id} className={item.completed ? 'subtask-completed' : undefined}>
          {item.completed ? <CheckSquare size={16} aria-label="Ukończone" role="img" />
            : <Square size={16} aria-label="Nieukończone" role="img" />}
          <span>{item.title}</span>
        </li>)}
      </ul>}
    </div>
  </div>
}
