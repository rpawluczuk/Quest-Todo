import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { createMilestone, getMilestones, setMilestoneCompleted, renameMilestone, deleteMilestone, type Milestone } from '../api/goalApi'
import TaskActionsMenu from './TaskActionsMenu'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import SortableMilestone from './SortableMilestone'
import { reorderMilestones, MilestoneOrderConflict } from '../api/goalApi'

export default function GoalMilestones({ goalId, onItemsChange }: {
  goalId: number
  onItemsChange?: (items: Milestone[]) => void
}) {
  const [items, setItems] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const editInput = useRef<HTMLInputElement>(null)
  const sending = useRef(false)
  const pending = useRef(new Set<number>())
  const [pendingIds, setPendingIds] = useState(new Set<number>())
  const [completionErrors, setCompletionErrors] = useState<Record<number, string>>({})
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [ordering, setOrdering] = useState(false)
  const [orderError, setOrderError] = useState('')
  const orderBusy = useRef(false)
  const onItemsChangeRef = useRef(onItemsChange)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const orderDisabled = ordering || saving || pendingIds.size > 0 || editingId !== null
  const mutationsDisabled = dragging || ordering
  useEffect(() => { onItemsChangeRef.current = onItemsChange }, [onItemsChange])
  useEffect(() => {
    if (!loading && !loadError) onItemsChangeRef.current?.(items)
  }, [items, loading, loadError])
  async function finishDrag({ active, over }: DragEndEvent) {
    setDragging(false)
    if (!over || active.id === over.id || orderBusy.current) return
    const previous = items
    const next = arrayMove(items, items.findIndex(item => item.id === active.id), items.findIndex(item => item.id === over.id))
    orderBusy.current = true
    setOrdering(true)
    setOrderError('')
    setItems(next)
    try {
      setItems(await reorderMilestones(goalId, next.map(item => item.id)))
    } catch (failure) {
      setItems(previous)
      if (failure instanceof MilestoneOrderConflict) {
        try { setItems(await getMilestones(goalId)) }
        catch { setOrderError('Nie udało się odświeżyć listy po konflikcie. Otwórz cel ponownie.'); return }
      }
      setOrderError(failure instanceof Error ? failure.message : 'Nie udało się zapisać kolejności.')
    } finally {
      orderBusy.current = false
      setOrdering(false)
    }
  }
  useEffect(() => {
    const controller = new AbortController()
    getMilestones(goalId, controller.signal).then(setItems).catch(failure => {
      if (!controller.signal.aborted) setLoadError(failure instanceof Error ? failure.message : 'Nie udało się pobrać kamieni milowych.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [goalId])
  useEffect(() => { if (open) input.current?.focus() }, [open])
  useEffect(() => { if (editingId !== null) editInput.current?.focus() }, [editingId])
  async function changeItem(item: Milestone, remove: boolean) {
    if (orderBusy.current || dragging) return
    if (pending.current.has(item.id)) return
    if (!remove && !editTitle.trim()) {
      setCompletionErrors(current => ({ ...current, [item.id]: 'Podaj nazwę kamienia milowego.' }))
      return
    }
    if (remove && !window.confirm(`Usunąć kamień milowy „${item.title}”? Cel pozostanie bez zmian.`)) return
    pending.current.add(item.id)
    setPendingIds(new Set(pending.current))
    setCompletionErrors(current => ({ ...current, [item.id]: '' }))
    try {
      if (remove) {
        await deleteMilestone(goalId, item.id)
        setItems(current => current.filter(value => value.id !== item.id))
      } else {
        const updated = await renameMilestone(goalId, item.id, editTitle.trim())
        setItems(current => current.map(value => value.id === item.id ? updated : value))
        setEditingId(null)
      }
    } catch (failure) {
      setCompletionErrors(current => ({ ...current, [item.id]: failure instanceof Error
        ? failure.message : 'Nie udało się zapisać zmiany kamienia milowego.' }))
    } finally {
      pending.current.delete(item.id)
      setPendingIds(new Set(pending.current))
    }
  }
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (orderBusy.current || dragging) return
    if (sending.current) return
    if (!title.trim()) { setError('Podaj nazwę kamienia milowego.'); return }
    sending.current = true
    setSaving(true)
    setError('')
    try {
      const item = await createMilestone(goalId, title.trim())
      setItems(current => [...current, item].sort((a, b) => a.position - b.position))
      setTitle('')
      setOpen(false)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się dodać kamienia milowego.')
    } finally { sending.current = false; setSaving(false) }
  }
  async function toggle(item: Milestone) {
    if (orderBusy.current || dragging) return
    if (pending.current.has(item.id)) return
    pending.current.add(item.id)
    setPendingIds(new Set(pending.current))
    setCompletionErrors(current => ({ ...current, [item.id]: '' }))
    setItems(current => current.map(value => value.id === item.id ? { ...value, completed: !item.completed } : value))
    try {
      const updated = await setMilestoneCompleted(goalId, item.id, !item.completed)
      setItems(current => current.map(value => value.id === item.id ? updated : value))
    } catch (failure) {
      setItems(current => current.map(value => value.id === item.id ? item : value))
      setCompletionErrors(current => ({ ...current, [item.id]: failure instanceof Error
        ? failure.message : 'Nie udało się zapisać ukończenia kamienia milowego.' }))
    } finally {
      pending.current.delete(item.id)
      setPendingIds(new Set(pending.current))
    }
  }
  return <section className="goal-tasks goal-milestones" id={`goal-milestones-${goalId}`}
    aria-labelledby={`milestones-heading-${goalId}`}>
    <div className="milestone-heading">
      <h3 id={`milestones-heading-${goalId}`}>Kamienie milowe</h3>
    </div>
    {loading && <p role="status">Ładowanie kamieni milowych…</p>}
    {loadError && <p className="form-error" role="alert">{loadError}</p>}
    {orderError && <p className="form-error" role="alert">{orderError}</p>}
    {!loading && !loadError && <>
      {items.length === 0 ? <p className="empty-state">Nie masz jeszcze kamieni milowych dla tego celu.</p>
        : <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={() => { setDragging(true); setOrderError('') }}
          onDragCancel={() => setDragging(false)} onDragEnd={event => void finishDrag(event)}
          accessibility={{
            screenReaderInstructions: { draggable: 'Naciśnij Space lub Enter, aby przenieść. Strzałki zmieniają pozycję. Space lub Enter zapisuje, Escape anuluje.' },
            announcements: {
              onDragStart: ({ active }) => `Przenosisz: ${items.find(item => item.id === active.id)?.title}.`,
              onDragOver: ({ over }) => over ? `Nowa pozycja: ${items.findIndex(item => item.id === over.id) + 1} z ${items.length}.` : undefined,
              onDragEnd: ({ over }) => over ? `Upuszczono na pozycji ${items.findIndex(item => item.id === over.id) + 1}.` : 'Anulowano przenoszenie.',
              onDragCancel: () => 'Anulowano przenoszenie.',
            },
          }}>
          <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
          <ol className="milestone-list">{items.map(item => <SortableMilestone key={item.id} id={item.id}
            title={item.title} disabled={orderDisabled}>{handle => <>
          {editingId === item.id ? <form className="milestone-form milestone-edit-form"
            onSubmit={event => { event.preventDefault(); void changeItem(item, false) }}>
            <label className="form-field"><span>Nazwa kamienia milowego</span>
              <input ref={editInput} value={editTitle} required maxLength={120} disabled={pendingIds.has(item.id)}
                onChange={event => setEditTitle(event.target.value)} /></label>
            <div className="task-actions">
              <button type="submit" disabled={pendingIds.has(item.id)}>Zapisz</button>
              <button type="button" className="secondary-button" disabled={pendingIds.has(item.id)}
                onClick={() => { setEditingId(null); setCompletionErrors(current => ({ ...current, [item.id]: '' })) }}>Anuluj</button>
            </div>
          </form> : <div className="milestone-row">
            <label className="task-card-check milestone-check">
              <input type="checkbox" checked={item.completed} disabled={pendingIds.has(item.id) || mutationsDisabled}
                aria-label={item.title} aria-describedby={completionErrors[item.id] ? `milestone-error-${item.id}` : undefined}
                onChange={() => void toggle(item)} />
            </label>
            <span className={item.completed ? 'milestone-completed' : undefined}>{item.title}</span>
            {handle}
            <TaskActionsMenu itemTitle={item.title} itemType="kamienia milowego"
              disabled={pendingIds.has(item.id) || editingId !== null || mutationsDisabled} actions={[
                { label: 'Edytuj', icon: 'pencil', onSelect: () => {
                  setEditingId(item.id); setEditTitle(item.title)
                  setCompletionErrors(current => ({ ...current, [item.id]: '' }))
                } },
                { label: 'Usuń', icon: 'trash-2', destructive: true, onSelect: () => void changeItem(item, true) },
              ]} />
          </div>}
          {completionErrors[item.id] && <p id={`milestone-error-${item.id}`} className="form-error" role="alert">
            {completionErrors[item.id]}
          </p>}
        </>}</SortableMilestone>)}</ol>
          </SortableContext>
        </DndContext>}
      {open ? <form className="milestone-form" onSubmit={submit}>
        <label className="form-field"><span>Nazwa kamienia milowego</span>
          <input ref={input} required maxLength={120} value={title} disabled={saving}
            placeholder="Np. Przebiegam 2 km bez przerwy" onChange={event => setTitle(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="task-actions">
          <button type="submit" disabled={saving || mutationsDisabled}>{saving ? 'Zapisywanie…' : 'Zapisz'}</button>
          <button type="button" className="secondary-button" disabled={saving}
            onClick={() => { setOpen(false); setTitle(''); setError('') }}>Anuluj</button>
        </div>
      </form> : <button type="button" className="secondary-button goal-attach-trigger"
        disabled={mutationsDisabled} onClick={() => setOpen(true)}>Dodaj kamień milowy</button>}
    </>}
  </section>
}
