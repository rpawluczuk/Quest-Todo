import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { CheckSquare, Square, ChevronDown, ChevronUp, Plus, CheckCircle } from 'lucide-react'
import { getSubtasks, createSubtask, renameSubtask, deleteSubtask } from '../api/subtaskApi'
import type { Subtask } from '../types/Subtask'
import TaskActionsMenu from './TaskActionsMenu'
import SubtaskTitleForm from './SubtaskTitleForm'

export type TaskSubtasksHandle = { openCreate: () => void }
type Props = {
  taskId: number; total: number; completed: number; disabled: boolean
  ref?: Ref<TaskSubtasksHandle>
  onCountsChange: (taskId: number, total: number, completed: number) => void
  onBusyChange: (busy: boolean) => void
}

export default function TaskSubtasks({ taskId, total, completed, disabled, ref, onCountsChange, onBusyChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [items, setItems] = useState<Subtask[] | null>(null)
  const [error, setError] = useState('')
  const [mutationError, setMutationError] = useState('')
  const [retry, setRetry] = useState(0)
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState('')
  const pending = useRef(false)
  const root = useRef<HTMLDivElement>(null)
  const request = useRef<Promise<Subtask[]> | null>(null)
  const knownCounts = useRef(`${total}:${completed}`)
  const listId = useId()

  useImperativeHandle(ref, () => ({ openCreate() {
    if (disabled || pending.current || editing !== null) return
    setExpanded(true); setEditing('new'); setMutationError(''); setError('')
  } }))

  useEffect(() => {
    const signature = `${total}:${completed}`
    if (knownCounts.current !== signature) {
      knownCounts.current = signature
      request.current = null
      setItems(null)
    }
  }, [total, completed])

  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(''), 3000)
    return () => window.clearTimeout(timer)
  }, [success])

  useEffect(() => {
    if (!expanded || items) return
    let active = true
    request.current ??= getSubtasks(taskId)
    void request.current.then(data => {
      if (active) setItems(data)
    }, failure => {
      request.current = null
      if (active) setError(failure instanceof Error ? failure.message : 'Nie udało się pobrać podzadań.')
    })
    return () => { active = false }
  }, [expanded, items, retry, taskId])

  function updateItems(next: Subtask[]) {
    const done = next.filter(item => item.completed).length
    knownCounts.current = `${next.length}:${done}`
    request.current = Promise.resolve(next)
    setItems(next)
    onCountsChange(taskId, next.length, done)
  }

  function focusControl() {
    requestAnimationFrame(() => {
      const target = root.current?.querySelector<HTMLButtonElement>('.task-subtasks-toggle, .subtask-add')
        ?? root.current?.closest('.task-card')?.querySelector<HTMLButtonElement>(':scope > .task-menu button')
      target?.focus()
    })
  }

  function closeEditor() {
    setEditing(null)
    if (!items?.length) setExpanded(false)
    focusControl()
  }

  async function mutate(action: () => Promise<void>) {
    if (pending.current || disabled) return
    pending.current = true; setBusy(true); onBusyChange(true)
    try { await action() }
    finally { pending.current = false; setBusy(false); onBusyChange(false) }
  }

  async function save(title: string) {
    await mutate(async () => {
      if (!items) throw new Error('Poczekaj na pobranie podzadań.')
      const saved = editing === 'new' ? await createSubtask(taskId, title) : await renameSubtask(taskId, editing!, title)
      updateItems(editing === 'new' ? [...items, saved].sort((a, b) => a.position - b.position || a.id - b.id)
        : items.map(item => item.id === saved.id ? saved : item))
      setSuccess(editing === 'new' ? 'Dodano podzadanie.' : 'Zapisano podzadanie.')
      setEditing(null)
      focusControl()
    })
  }

  async function remove(item: Subtask) {
    if (pending.current || disabled || !window.confirm(`Usunąć podzadanie? Podzadanie „${item.title}” zostanie trwale usunięte.`)) return
    setMutationError('')
    try {
      await mutate(async () => {
        await deleteSubtask(taskId, item.id)
        const next = items!.filter(current => current.id !== item.id)
        updateItems(next)
        if (!next.length) setExpanded(false)
        setSuccess('Usunięto podzadanie.')
        focusControl()
      })
    } catch (failure) {
      setMutationError(failure instanceof Error ? failure.message : 'Nie udało się usunąć podzadania.')
    }
  }

  const count = items?.length ?? total
  const done = items?.filter(item => item.completed).length ?? completed
  const Chevron = expanded ? ChevronUp : ChevronDown
  const locked = disabled || busy

  return <div ref={root} className="task-subtasks" hidden={!count && editing === null && !success}
    onClick={event => event.stopPropagation()}>
    {count > 0 && <button type="button" className="task-subtasks-toggle" aria-expanded={expanded} aria-controls={listId}
      disabled={locked || editing !== null} onClick={() => { setError(''); setExpanded(value => !value) }}>
      <CheckSquare size={16} aria-hidden="true" /><span>{done}/{count} podzadań</span><Chevron size={16} aria-hidden="true" />
    </button>}
    <div id={listId} hidden={!expanded}>
      {expanded && !items && !error && <p className="task-subtasks-message" role="status">Ładowanie podzadań…</p>}
      {expanded && error && <div className="task-subtasks-message"><span role="alert">{error}</span>
        <button type="button" className="task-subtasks-retry" onClick={() => { setError(''); setRetry(value => value + 1) }}>Spróbuj ponownie</button>
        {editing === 'new' && <button type="button" className="task-subtasks-retry" onClick={closeEditor}>Anuluj</button>}
      </div>}
      {items && <>
        <ul className="task-subtasks-list">
          {items.map(item => <li key={item.id} className={item.completed ? 'subtask-completed' : undefined}>
            {editing === item.id ? <SubtaskTitleForm initialTitle={item.title} editing busy={locked} onSave={save} onCancel={closeEditor} /> : <>
              {item.completed ? <CheckSquare size={16} aria-label="Ukończone" role="img" /> : <Square size={16} aria-label="Nieukończone" role="img" />}
              <span className="subtask-title">{item.title}</span>
              <TaskActionsMenu itemTitle={item.title} itemType="podzadania" disabled={locked || editing !== null} actions={[
                { label: 'Edytuj', icon: 'pencil', onSelect: () => { setEditing(item.id); setMutationError('') } },
                { label: 'Usuń', icon: 'trash-2', destructive: true, onSelect: () => void remove(item) },
              ]} />
            </>}
          </li>)}
        </ul>
        {editing === 'new' ? <SubtaskTitleForm busy={locked} onSave={save} onCancel={closeEditor} />
          : <button type="button" className="task-subtasks-toggle subtask-add" disabled={locked || editing !== null}
            onClick={() => { setEditing('new'); setMutationError('') }}><Plus size={16} aria-hidden="true" />Dodaj podzadanie</button>}
      </>}
      {mutationError && <p role="alert" className="form-error">{mutationError}</p>}
    </div>
    {success && <div className="habit-toast-region"><div className="habit-toast milestone-success-toast">
      <CheckCircle size={20} aria-hidden="true" /><span role="status">{success}</span>
    </div></div>}
  </div>
}
