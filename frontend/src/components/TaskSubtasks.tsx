import { useSubtasks } from './SubtaskProvider'
import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { CheckSquare, ChevronDown, ChevronUp, Plus, CheckCircle } from 'lucide-react'
import { createSubtask, renameSubtask, deleteSubtask, setSubtaskCompleted } from '../api/subtaskApi'
import type { Subtask } from '../types/Subtask'
import TaskActionsMenu from './TaskActionsMenu'
import SubtaskTitleForm from './SubtaskTitleForm'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import SortableSubtask from './SortableSubtask'
import { reorderSubtasks, SubtaskOrderConflict } from '../api/subtaskApi'

export type TaskSubtasksHandle = { openCreate: () => void }
type Props = {
  taskId: number; total: number; completed: number; disabled: boolean
  readOnly?: boolean
  ref?: Ref<TaskSubtasksHandle>
  onCountsChange: (taskId: number, total: number, completed: number) => void
  onBusyChange: (busy: boolean) => void
}

export default function TaskSubtasks({ taskId, total, completed, disabled: externalDisabled, readOnly = false, ref, onCountsChange, onBusyChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { store, items, owner: busyOwner } = useSubtasks(taskId)
  const owner = useRef(Symbol('subtask editor'))
  const disabled = externalDisabled || readOnly || (busyOwner !== null && busyOwner !== owner.current)
  const [error, setError] = useState('')
  const [mutationError, setMutationError] = useState('')
  const [retry, setRetry] = useState(0)
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragActive = useRef(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const [success, setSuccess] = useState('')
  const [statusError, setStatusError] = useState('')
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set())
  const pendingStatuses = useRef(new Set<number>())
  const currentItems = useRef<Subtask[]>([])
  const pending = useRef(false)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => () => {
    // Closing a goal during a drag must not leave its task locked in another view.
    if (dragActive.current) store.release(taskId, owner.current)
  }, [store, taskId])

  useImperativeHandle(ref, () => ({ openCreate() {
    if (disabled || dragActive.current || pending.current || pendingStatuses.current.size || editing !== null) return
    setExpanded(true); setEditing('new'); setMutationError(''); setError('')
  } }))

  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(''), 3000)
    return () => window.clearTimeout(timer)
  }, [success])

  useEffect(() => {
    if (!statusError) return
    const timer = window.setTimeout(() => setStatusError(''), 5000)
    return () => window.clearTimeout(timer)
  }, [statusError])

  useEffect(() => {
    if (!expanded || items) return
    let active = true
    void store.load(taskId).catch(failure => {
      if (active) setError(failure instanceof Error ? failure.message : 'Nie udało się pobrać podzadań.')
    })
    return () => { active = false }
  }, [expanded, items, retry, taskId, store])

  currentItems.current = items ?? []

  function updateItems(next: Subtask[]) {
    currentItems.current = next
    const done = next.filter(item => item.completed).length
    store.set(taskId, next)
    onCountsChange(taskId, next.length, done)
  }

  function focusControl() {
    requestAnimationFrame(() => {
      const target = root.current?.querySelector<HTMLButtonElement>('.task-subtasks-toggle, .subtask-add')
        ?? root.current?.closest('.task-card, .goal-linked-task')?.querySelector<HTMLButtonElement>(':scope > .task-menu button')
      target?.focus()
    })
  }

  function closeEditor() {
    setEditing(null)
    if (!items?.length) setExpanded(false)
    focusControl()
  }

  async function mutate(action: () => Promise<void>) {
    if (dragActive.current || pending.current || pendingStatuses.current.size || disabled) return
    if (!store.claim(taskId, owner.current)) return
    pending.current = true; setBusy(true); onBusyChange(true)
    try { await action() }
    finally { pending.current = false; setBusy(false); store.release(taskId, owner.current); onBusyChange(false) }
  }

  async function toggle(item: Subtask) {
    if (disabled || dragActive.current || pending.current || editing !== null || pendingStatuses.current.has(item.id)) return
    if (!store.claim(taskId, owner.current)) return
    pendingStatuses.current.add(item.id)
    setSavingIds(new Set(pendingStatuses.current))
    onBusyChange(true)
    setStatusError('')
    updateItems(currentItems.current.map(row => row.id === item.id ? { ...row, completed: !item.completed } : row))
    try {
      const saved = await setSubtaskCompleted(taskId, item.id, !item.completed)
      updateItems(currentItems.current.map(row => row.id === item.id ? saved : row))
    } catch (failure) {
      // Roll back only this row; other in-flight rows may already have changed.
      updateItems(currentItems.current.map(row => row.id === item.id ? { ...row, completed: item.completed } : row))
      setStatusError(failure instanceof Error ? failure.message : 'Nie udało się zapisać statusu podzadania.')
    } finally {
      pendingStatuses.current.delete(item.id)
      setSavingIds(new Set(pendingStatuses.current))
      if (!pendingStatuses.current.size) store.release(taskId, owner.current)
      onBusyChange(pendingStatuses.current.size > 0)
    }
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
  const orderDisabled = disabled || busy || savingIds.size > 0 || editing !== null
  const locked = disabled || busy || savingIds.size > 0 || dragging

  function cancelDrag() {
    dragActive.current = false; setDragging(false); store.release(taskId, owner.current); onBusyChange(false)
  }

  async function finishDrag({ active, over }: DragEndEvent) {
    cancelDrag()
    if (!over || active.id === over.id || orderDisabled) return
    const previous = currentItems.current
    const from = previous.findIndex(item => item.id === active.id)
    const to = previous.findIndex(item => item.id === over.id)
    if (from < 0 || to < 0) return
    await mutate(async () => {
      setStatusError('')
      const next = arrayMove(previous, from, to).map((item, position) => ({ ...item, position }))
      updateItems(next)
      try {
        updateItems(await reorderSubtasks(taskId, next.map(item => item.id)))
      } catch (failure) {
        updateItems(previous)
        setStatusError(failure instanceof Error ? failure.message : 'Nie udało się zapisać kolejności.')
        if (failure instanceof SubtaskOrderConflict) {
          try { updateItems(await store.load(taskId, true)) }
          catch { store.set(taskId, null); setError('Nie udało się odświeżyć podzadań. Spróbuj ponownie.') }
        }
      }
    })
  }

  return <div ref={root} className="task-subtasks" hidden={!count && editing === null && !success}
    onClick={event => event.stopPropagation()}>
    {count > 0 && <button type="button" className="task-subtasks-toggle" aria-expanded={expanded} aria-controls={listId}
      disabled={externalDisabled || busyOwner !== null || editing !== null} onClick={() => { setError(''); setExpanded(value => !value) }}>
      <CheckSquare size={16} aria-hidden="true" /><span>{done}/{count} podzadań</span><Chevron size={16} aria-hidden="true" />
    </button>}
    <div id={listId} hidden={!expanded}>
      {expanded && !items && !error && <p className="task-subtasks-message" role="status">Ładowanie podzadań…</p>}
      {expanded && error && <div className="task-subtasks-message"><span role="alert">{error}</span>
        <button type="button" className="task-subtasks-retry" onClick={() => { setError(''); setRetry(value => value + 1) }}>Spróbuj ponownie</button>
        {editing === 'new' && <button type="button" className="task-subtasks-retry" onClick={closeEditor}>Anuluj</button>}
      </div>}
      {items && <>
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={() => { store.claim(taskId, owner.current); dragActive.current = true; setDragging(true); onBusyChange(true) }}
          onDragCancel={cancelDrag} onDragEnd={event => void finishDrag(event)}
          accessibility={{ screenReaderInstructions: { draggable: 'Naciśnij spację, aby podnieść podzadanie. Strzałkami zmień pozycję. Spacją zapisz, Escape anuluje.' } }}>
        <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
        <ul className="task-subtasks-list">
          {items.map(item => <SortableSubtask key={item.id} id={item.id} title={item.title} completed={item.completed} disabled={orderDisabled}>
            {handle => <>
            {editing === item.id ? <SubtaskTitleForm initialTitle={item.title} editing busy={locked} onSave={save} onCancel={closeEditor} /> : <>
              <label className="subtask-check">
                <input type="checkbox" checked={item.completed} aria-label={`Podzadanie: ${item.title}`}
                  disabled={disabled || busy || dragging || editing !== null || savingIds.has(item.id)}
                  onChange={() => void toggle(item)} />
              </label>
              <span className="subtask-title">{item.title}</span>
              {!readOnly && handle}
              {!readOnly && <TaskActionsMenu itemTitle={item.title} itemType="podzadania" disabled={locked || editing !== null} actions={[
                { label: 'Edytuj', icon: 'pencil', onSelect: () => { setEditing(item.id); setMutationError('') } },
                { label: 'Usuń', icon: 'trash-2', destructive: true, onSelect: () => void remove(item) },
              ]} />}
            </>}
          </>}</SortableSubtask>)}
        </ul>
        </SortableContext>
        </DndContext>
        {!readOnly && (editing === 'new' ? <SubtaskTitleForm busy={locked} onSave={save} onCancel={closeEditor} />
          : <button type="button" className="task-subtasks-toggle subtask-add" disabled={locked || editing !== null}
            onClick={() => { setEditing('new'); setMutationError('') }}><Plus size={16} aria-hidden="true" />Dodaj podzadanie</button>)}
      </>}
      {mutationError && <p role="alert" className="form-error">{mutationError}</p>}
    </div>
    {success && <div className="habit-toast-region"><div className="habit-toast milestone-success-toast">
      <CheckCircle size={20} aria-hidden="true" /><span role="status">{success}</span>
    </div></div>}
    {statusError && <div className="habit-toast-region"><div className="habit-toast" role="alert">{statusError}</div></div>}
  </div>
}
