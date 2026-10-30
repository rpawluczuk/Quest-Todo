import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { Clock3, Pause } from 'lucide-react'
import { getAvailableGoalHabits, getGoalHabits, setGoalHabit, type GoalHabit } from '../api/goalApi'
import { HabitUpdateConflictError, updateHabit } from '../api/habitApi'
import { useHabitStore } from './HabitProvider'
import { habitStatusAction } from '../habitStore'
import EditHabitForm from './EditHabitForm'
import { formatHabitProgress } from '../habitTarget'
import type { Habit, HabitSchedule } from '../types/Habit'
import { habitToday } from '../weekDates'
import TaskActionsMenu from './TaskActionsMenu'
import type { GoalSectionActionHandle, GoalSectionActionProps } from './GoalSectionAction'

const GoalHabits = forwardRef<GoalSectionActionHandle, {
  goalId: number; goalTitle: string; onGoalLinksChanged: () => void
  readOnly?: boolean
  onPointsChanged: (balance: number) => void
  revision: number
  onCountChange?: (goalId: number, count: number) => void
} & GoalSectionActionProps>(function GoalHabits({ goalId, goalTitle, onGoalLinksChanged, onCountChange,
  revision, actionTriggerRef, onActionDisabledChange, readOnly = false, onPointsChanged }, ref) {
  const store = useHabitStore()
  const today = habitToday()
  const detailsById = new Map((store.get(today) ?? []).map(habit => [habit.id, habit]))
  const [editingId, setEditingId] = useState<number | null>(null)
  const editingHabit = editingId === null ? null : detailsById.get(editingId)
  const [attached, setAttached] = useState<GoalHabit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [available, setAvailable] = useState<GoalHabit[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const sending = useRef(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const titleId = useId()

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([getGoalHabits(goalId, controller.signal), store.load(today)]).then(([result]) => {
      if (!controller.signal.aborted) { setAttached(result); setLoadError('') }
    }).catch(failure => {
      if (!controller.signal.aborted) setLoadError(failure instanceof Error ? failure.message : 'Nie udało się pobrać nawyków.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [goalId, retry, revision, store, today])

  useEffect(() => { onCountChange?.(goalId, attached.length) }, [attached.length, goalId, onCountChange])

  useEffect(() => {
    if (!pickerOpen || queryInput.trim() === query) return
    const timer = window.setTimeout(() => { setPickerLoading(true); setQuery(queryInput.trim()) }, 250)
    return () => window.clearTimeout(timer)
  }, [pickerOpen, queryInput, query])

  useEffect(() => {
    if (!pickerOpen) return
    const controller = new AbortController()
    getAvailableGoalHabits(goalId, query, 0, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setAvailable(result.habits)
      setHasMore(result.hasMore)
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Nie udało się pobrać nawyków.')
    }).finally(() => { if (!controller.signal.aborted) setPickerLoading(false) })
    return () => controller.abort()
  }, [goalId, pickerOpen, query, retry])

  useEffect(() => {
    if (!pickerOpen) return
    const element = dialog.current
    element?.showModal()
    search.current?.focus()
    return () => element?.close()
  }, [pickerOpen])

  const disabled = readOnly || busy || pickerLoading || queryInput.trim() !== query
  const actionDisabled = readOnly || loading || !!loadError || busy || pickerOpen
  useImperativeHandle(ref, () => ({
    activate: () => {
      if (actionDisabled) return
      setError('')
      setPickerLoading(true)
      setPickerOpen(true)
    },
  }), [actionDisabled])
  useEffect(() => {
    onActionDisabledChange?.(goalId, 'habits', actionDisabled)
  }, [actionDisabled, goalId, onActionDisabledChange])

  async function run(action: () => Promise<void>) {
    if (readOnly || sending.current) return
    sending.current = true
    setBusy(true)
    setError('')
    try { await action() }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Nie udało się zapisać zmiany.') }
    finally { sending.current = false; setBusy(false) }
  }

  async function changeStatus(habit: Habit) {
    if (readOnly || busy || store.statusUpdates.pending(habit.id)) return
    setError('')
    try {
      const action = habitStatusAction(habit)
      if (await store.changeStatus(habit, action.next)) setNotice(action.message)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się zmienić statusu nawyku.')
    } finally {
      requestAnimationFrame(() => {
        if (document.activeElement === document.body)
          document.querySelector<HTMLButtonElement>(`#goal-habits-${goalId} [data-habit-id="${habit.id}"] .task-menu-trigger`)?.focus()
      })
    }
  }

  async function save(id: number, name: string, target: number, points: number, description: string,
    schedule: HabitSchedule, categoryId: number | null, goalIds: number[]) {
    if (readOnly || sending.current || store.statusUpdates.pending(id)) throw new Error('Poczekaj na zakończenie zapisu.')
    sending.current = true
    setBusy(true)
    try {
      const result = await updateHabit(id, name, target, points, description, schedule, categoryId, goalIds)
      store.update(result.habit, today)
      if (result.balance !== null) onPointsChanged(result.balance)
      onGoalLinksChanged()
      setEditingId(null)
    } catch (failure) {
      if (failure instanceof HabitUpdateConflictError) await store.load(today, true).catch(() => undefined)
      throw failure
    } finally { sending.current = false; setBusy(false) }
  }

  const isWaiting = (habit: GoalHabit) => {
    const status = detailsById.get(habit.id)?.activityStatus
    return status === 'PAUSED' || status === 'PLANNED'
  }
  const groups = [
    { title: '', items: attached.filter(habit => !isWaiting(habit)) },
    { title: 'Poczekalnia', items: attached.filter(isWaiting) },
  ]

  function closePicker() {
    if (sending.current) return
    setPickerOpen(false)
    setQueryInput('')
    setQuery('')
    setAvailable([])
    setHasMore(false)
    setError('')
    setNotice('')
    requestAnimationFrame(() => actionTriggerRef?.current?.focus())
  }

  function attach(habit: GoalHabit) {
    void run(async () => {
      await setGoalHabit(goalId, habit.id, true)
      store.updateGoalLink(habit.id, goalId, goalTitle, true)
      setAttached(current => current.some(item => item.id === habit.id) ? current : [...current, habit])
      onGoalLinksChanged()
      setNotice(`Przypięto: ${habit.name}`)
    })
  }

  function loadMore() {
    void run(async () => {
      // The server excludes attached habits, so account for removed candidates when paging.
      const remaining = available.filter(habit => !attached.some(item => item.id === habit.id))
      const page = Math.floor(remaining.length / 20)
      let result = await getAvailableGoalHabits(goalId, query, page)
      if (result.hasMore && result.habits.every(habit => available.some(item => item.id === habit.id))) {
        result = await getAvailableGoalHabits(goalId, query, page + 1)
      }
      setAvailable(current => [...current, ...result.habits.filter(habit => !current.some(item => item.id === habit.id))])
      setHasMore(result.hasMore)
    })
  }

  return <div className="goal-tasks" id={`goal-habits-${goalId}`}>
    {loading ? <p role="status">Ładowanie nawyków…</p> : loadError ? <>
      <p className="form-error" role="alert">{loadError}</p>
      <button type="button" className="goal-picker-link" onClick={() => {
        setLoading(true); setRetry(value => value + 1)
      }}>Spróbuj ponownie</button>
    </> : <>
      {attached.length === 0 && <p className="empty-state goal-linked-empty">Brak przypisanych nawyków</p>}
      {groups.filter(group => group.items.length > 0).map(group => <section key={group.title} className="goal-habit-group"
        aria-label={group.title || undefined}>
        {group.title && <h3 className="goal-habit-waiting-heading">{group.title}</h3>}
        <ul className="task-list goal-linked-tasks">
        {group.items.map(habit => {
          const details = detailsById.get(habit.id)
          const name = details?.name ?? habit.name
          const waiting = isWaiting(habit)
          const statusAction = details ? habitStatusAction(details) : null
          const progress = details
            ? formatHabitProgress(details.weeklyCompletedDays, details.target?.targetDays ?? null)
            : null
          return <li key={habit.id} className="goal-linked-task goal-linked-habit" data-habit-id={habit.id}
            aria-busy={store.statusUpdates.pending(habit.id)}>
          <span className="goal-linked-item-title">{name}</span>
          {waiting && details && <div className="goal-linked-item-meta">
            <span className="habit-waiting-status">{details.activityStatus === 'PAUSED'
              ? <><Pause size={16} aria-hidden="true" />Wstrzymany</>
              : <><Clock3 size={16} aria-hidden="true" />Zaplanowany</>}</span>
            {details.activityStatus === 'PAUSED' && details.totalCompletions > 0
              && <span className="goal-linked-habit-progress">{details.totalCompletions} wykonań łącznie</span>}
          </div>}
          {!waiting && details && progress && <div className="goal-linked-item-meta">
            <span className="goal-linked-habit-progress">
              <strong>{progress.count}</strong> {progress.period}
            </span>
            <span className="task-points task-card-points">{details.rewardPoints} pkt</span>
          </div>}
          {!readOnly && <TaskActionsMenu itemTitle={name} itemType="nawyku" disabled={busy || store.statusUpdates.pending(habit.id)} actions={[
            ...(details && statusAction ? [{ label: statusAction.label, icon: statusAction.icon,
              onSelect: () => void changeStatus(details) }] : []),
            ...(details && !details.endedOn ? [{ label: 'Edytuj', icon: 'pencil' as const,
              onSelect: () => setEditingId(habit.id) }] : []), {
            label: 'Odepnij od celu', onSelect: () => void run(async () => {
              await setGoalHabit(goalId, habit.id, false)
              store.updateGoalLink(habit.id, goalId, goalTitle, false)
              setAttached(current => current.filter(item => item.id !== habit.id))
              onGoalLinksChanged()
            }),
          }]} />}
        </li>})}
      </ul></section>)}
      {!pickerOpen && notice && <p role="status" className="goal-picker-notice">{notice}</p>}
      {!pickerOpen && busy && <p role="status">Zapisywanie…</p>}
      {!pickerOpen && error && <p className="form-error" role="alert">{error}</p>}
    </>}
    {editingHabit && !readOnly && <EditHabitForm habit={editingHabit} onCancel={() => setEditingId(null)}
      onSave={(name, target, points, description, schedule, categoryId, goalIds) =>
        save(editingHabit.id, name, target, points, description, schedule, categoryId, goalIds)} />}
    {pickerOpen && <dialog ref={dialog} className="password-dialog goal-picker-dialog" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); closePicker() }}>
      <div className="goal-picker-header">
        <button type="button" className="password-dialog-close" aria-label="Zamknij" disabled={busy} onClick={closePicker}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
        <h2 id={titleId}>Przypnij nawyki</h2>
        <p className="goal-picker-context">Do celu: {goalTitle}</p>
        <label className="form-field"><span>Wyszukaj nawyk</span>
          <input ref={search} type="search" value={queryInput} disabled={busy} placeholder="Wpisz nazwę nawyku"
            onChange={event => { setError(''); setQueryInput(event.target.value) }} />
        </label>
      </div>
      <div className="goal-picker-results" aria-busy={pickerLoading}>
        {pickerLoading ? <p role="status">Ładowanie nawyków…</p> : <>
          {available.length > 0 ? <ul className="goal-available-list">
            {available.map(habit => <li key={habit.id} className="goal-available-task">
              <span className="goal-available-task-title">{habit.name}</span>
              {attached.some(item => item.id === habit.id) ? <span className="goal-picker-attached">✓ Przypięto</span> :
                <button type="button" className="goal-picker-link" disabled={disabled}
                  aria-label={`Przypnij nawyk: ${habit.name}`} onClick={() => attach(habit)}>Przypnij</button>}
            </li>)}
          </ul> : !error && <p className="empty-state">{query ? 'Nie znaleziono nawyków.' : 'Brak nawyków do przypięcia.'}</p>}
          {hasMore && <button type="button" className="goal-picker-link" disabled={disabled} onClick={loadMore}>Pokaż więcej</button>}
        </>}
      </div>
      <div className="goal-picker-footer">
        <p className="goal-picker-notice" role="status">{busy ? 'Zapisywanie…' : notice}</p>
        {error && <div><p className="form-error" role="alert">{error}</p>
          <button type="button" className="goal-picker-link" disabled={disabled} onClick={() => {
            setError(''); setPickerLoading(true); setRetry(value => value + 1)
          }}>Odśwież listę</button></div>}
        <button type="button" className="goal-picker-close" disabled={busy} onClick={closePicker}>Gotowe</button>
      </div>
    </dialog>}
  </div>
})

export default GoalHabits
